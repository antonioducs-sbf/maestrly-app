import { expect,test } from '@playwright/test'
import type { ProjectChatSnapshot,ProjectChatEvent } from '@maestrly/protocol'
import { applyProjectChatEvent } from '@maestrly/client-sdk'
import { translate,type Locale } from '../src/i18n/index.js'

test('project chat streams parts, retains history and accepts decisions in the web',async({page},info)=>{
  const L=(key:string)=>translate(key,info.project.name as Locale),org=crypto.randomUUID(),project=crypto.randomUUID(),board=crypto.randomUUID(),sessionId=crypto.randomUUID(),runner=crypto.randomUUID(),now=new Date().toISOString()
  let created=false,decisions=0,cancelled=false
  let state:ProjectChatSnapshot={session:{id:sessionId,organizationId:org,projectId:project,ownerUserId:'owner',runnerId:runner,workspaceKey:'workspace',title:'Architecture discussion',model:'fixture',mode:'agent',baseBranch:'main',boardId:board,cardId:null,version:1,archivedAt:null,createdAt:now,updatedAt:now},messages:[],interactions:[],turn:null,cursor:0,more:false}
  let events:ProjectChatEvent[]=[]
  await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname
    if(path.endsWith('/get-session'))return route.fulfill({json:{user:{id:'owner',name:'Ada Lovelace',email:'ada@example.test'}}})
    if(path==='/api/v1/organizations')return route.fulfill({json:[{id:org,name:'Maestrly',role:'owner'}]})
    if(path.endsWith('/projects'))return route.fulfill({json:[{id:project,organizationId:org,name:'Launch control',currentRole:'maintainer'}]})
    if(path.endsWith('/boards'))return route.fulfill({json:[{id:board,projectId:project,name:'Delivery board'}]})
    if(path.endsWith('/boards/'+board))return route.fulfill({json:{board:{id:board,projectId:project,name:'Delivery board'},columns:[],cards:[]}})
    if(path.endsWith('/chat/destinations'))return route.fulfill({json:[{runnerId:runner,name:'Maestrly Studio',online:true,personal:true,inventory:{capability:'chat:interactive:v1',enabled:true,models:[{id:'fixture',label:'Maestrly · Fixture'}],workspaces:[{projectId:project,key:'workspace',label:'maestrly',branches:['main']}],integrations:{skills:true,memory:true,mcp:true}}}]})
    if(path.endsWith('/chat/sessions')){
      if(req.method()==='POST'){created=true;return route.fulfill({json:state.session})}
      return route.fulfill({json:{items:created?[state.session]:[],nextCursor:null}})
    }
    if(path.endsWith('/sessions/'+sessionId))return route.fulfill({json:state})
    if(path.endsWith('/sessions/'+sessionId+'/messages')){
      const body=req.postDataJSON(),turnId=crypto.randomUUID(),messageId=crypto.randomUUID()
      state={...state,turn:{id:turnId,sessionId,messageId:crypto.randomUUID(),state:'running',leaseId:crypto.randomUUID(),leaseExpiresAt:new Date(Date.now()+60000).toISOString(),createdAt:now,error:null},messages:[...state.messages,{id:crypto.randomUUID(),sessionId,turnId,role:'user',createdAt:now,parts:[{type:'text',id:'text',text:body.text}]}]}
      const payloads:ProjectChatEvent['payload'][]=[{type:'message',message:{id:messageId,sessionId,turnId,role:'assistant',createdAt:new Date().toISOString(),parts:[]}},{type:'delta',messageId,partId:'text',kind:'text',delta:'I found the completed card. '},{type:'delta',messageId,partId:'text',kind:'text',delta:'The project memory confirms the decision.'},{type:'tool',messageId,part:{id:'search',type:'tool',name:'board_search_cards',state:'completed',output:'{"items":[]}'}},{type:'interaction',interaction:{id:crypto.randomUUID(),sessionId,turnId,version:1,payload:{type:'question',requestId:'question',questions:[{question:'Which branch should I use?',options:[{label:'main'},{label:'release'}]}]},state:'pending',decision:null}}]
      events=payloads.map((payload,i)=>({version:1,sessionId,sequence:state.cursor+i+1,eventId:crypto.randomUUID(),payload}))
      return route.fulfill({json:state.turn})
    }
    if(path.endsWith('/sessions/'+sessionId+'/events')){
      const next=events.filter(e=>e.sequence>Number(url.searchParams.get('cursor')??0))
      for(const event of next)state=applyProjectChatEvent(state,event)
      return route.fulfill({contentType:'text/event-stream',body:next.map(e=>'id: '+e.sequence+'\ndata: '+JSON.stringify(e)+'\n\n').join('')||': keep-alive\n\n'})
    }
    if(path.endsWith('/decisions')){decisions++;const decision=req.postDataJSON().decision;state={...state,interactions:state.interactions.map(i=>({...i,state:'decided',decision}))};return route.fulfill({json:{ok:true}})}
    if(path.endsWith('/cancel')){cancelled=true;state={...state,turn:state.turn?{...state.turn,state:'cancelled'}:null};return route.fulfill({json:state.turn})}
    if(path.endsWith('/events'))return route.fulfill({contentType:'text/event-stream',body:': ready\n\n'})
    return route.fulfill({json:[]})
  })
  page.on('pageerror', e => console.error('CHAT PAGE ERROR',e.message))
  await page.goto('/')
  await page.getByRole('button',{name:L('Project chat'),exact:true}).click()
  await expect(page.getByRole('dialog',{name:L('Project chat')})).toBeVisible({timeout:5000})
  await page.getByRole('button',{name:L('Start conversation'),exact:true}).click()
  await page.getByRole('textbox',{name:L('Message the project')}).fill('Find the decision in completed work')
  await page.getByRole('button',{name:L('Send message'),exact:true}).click()
  await expect(page.locator('.project-chat-message.assistant')).toContainText('I found the completed card. The project memory confirms the decision.')
  await expect(page.getByRole('button',{name:L('Stop response'),exact:true})).toBeVisible()
  await page.getByRole('radio',{name:'main',exact:true}).check()
  await page.getByRole('button',{name:L('Send response'),exact:true}).click()
  expect(decisions).toBe(1)
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:900})
    await expect(page.getByRole('dialog',{name:L('Project chat')})).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:info.outputPath('chat-'+width+'.png')})
  }
  await page.reload();await page.getByRole('button',{name:L('Project chat'),exact:true}).click()
  await expect(page.locator('.project-chat-message.assistant')).toHaveCount(1)
  await page.getByRole('button',{name:L('Stop response'),exact:true}).click();expect(cancelled).toBe(true)
  await page.getByRole('button',{name:L('Close chat'),exact:true}).click()
  await expect(page.getByRole('dialog',{name:L('Project chat')})).toHaveCount(0)
})
