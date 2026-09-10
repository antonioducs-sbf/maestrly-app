import { expect, it } from 'vitest'
import { integrationAvailable } from './helpers.js'
import { chatFixture } from './project-chat-fixture.js'
import { claimChat } from '../../src/modules/project-chat/dispatch.js'
import { executeChatTool } from '../../src/modules/project-chat/tools.js'
import { createCard, updateCard, moveCard } from '../../src/modules/cards/service.js'
import { getBoard } from '../../src/modules/boards/service.js'
import { createProject } from '../../src/modules/projects/service.js'

it.skipIf(!integrationAvailable)('finds done and archived cards and confines tool authority to the session project',async()=>{
  const f=await chatFixture()
  try{
    const board=await getBoard(f.pool,{...f.scope,boardId:f.boardId})
    const card=await createCard(f.pool,{...f.scope,boardId:f.boardId,title:'Historic release evidence'})
    await moveCard(f.pool,{...f.scope,cardId:card.id,move:{expectedVersion:1,targetColumnId:board.columns.find(c=>c.role==='done')!.id,targetPosition:0,source:'human',allowAutomationChain:false,chainDepth:0}})
    await updateCard(f.pool,{...f.scope,cardId:card.id,patch:{expectedVersion:2,archived:true}})
    await f.send('Find historic work');const claim=(await claimChat(f.pool,f.identity))!
    const result=await executeChatTool(f.pool,f.scope.organizationId,claim.token,'board_search_cards',{query:'Historic',done:true,archived:true},'search') as {items:Array<{id:string}>}
    expect(result.items.map(c=>c.id)).toContain(card.id)
    const other=await createProject(f.pool,{organizationId:f.scope.organizationId,actorUserId:f.scope.userId,name:'Other'})
    await expect(executeChatTool(f.pool,f.scope.organizationId,claim.token,'board_get_board',{boardId:other.boardId},'cross-project')).rejects.toThrow(/outside/)
    await expect(executeChatTool(f.pool,f.scope.organizationId,'wrong-token','board_list_boards',{},'wrong')).rejects.toThrow(/invalid/)
  }finally{await f.pool.end()}
})
