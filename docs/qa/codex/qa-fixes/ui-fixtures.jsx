// QA-only: existing UI + authorized fixture views. No session, API or database writes.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getSceneFixture, sceneFixtureList } from '../../../../packages/fixtures/src/index';
import { GameScreen } from '../../../../apps/web/src/ui/GameScreen';
import '../../../../apps/web/src/ui/styles.css';
function QA() {
 const [id,setId]=useState('veto-response'), [selection,setSelection]=useState(null), [open,setOpen]=useState(false), [message,setMessage]=useState(''), [failed,setFailed]=useState(false), [offline,setOffline]=useState(false), [intents,setIntents]=useState([]);
 const fixture=getSceneFixture(id)||sceneFixtureList[0], view=offline?{...fixture.view,connection:'disconnected'}:fixture.view;
 const room={phase:'game',mode:'dev',view,cues:fixture.cues,selection,connection:view.connection,busyActionId:null,transient:failed?'SERVICE_UNAVAILABLE':null,rolePanelOpen:open,setRolePanelOpen:setOpen,clearSelection:()=>setSelection(null),onIntent:i=>{setIntents(a=>[...a,i.type+(i.type==='inspect_own_role'?':'+String(i.open):'')]);if(i.type==='select_option')setSelection({actionId:i.actionId,optionId:i.optionId});else if(i.type==='inspect_own_role')setOpen(i.open ?? true)},submitSelected:()=>setMessage('Sentetik seçim: '+JSON.stringify(selection)),refresh:()=>setMessage('Sentetik yenileme; ağ yok'),playAgain:()=>setMessage('Sentetik yeniden oynama; ağ yok'),returnToLobby:()=>setMessage('Sentetik lobi; ağ yok')};
 return <><div style={{padding:8,background:'#eee',color:'#111'}}>QA fixture · ağ yok <select aria-label="QA senaryosu" value={id} onChange={e=>{setId(e.target.value);setSelection(null);setOpen(false);setMessage('');setIntents([])}}>{sceneFixtureList.map(f=><option key={f.id} value={f.id}>{f.title}</option>)}</select><label><input type="checkbox" checked={failed} onChange={e=>setFailed(e.target.checked)}/>Sentetik servis hatası</label><output data-qa-intents={JSON.stringify(intents)} data-qa-selection={JSON.stringify(selection)}>{message}</output></div><label style={{display:'block',background:'#eee',color:'#111'}}><input type="checkbox" checked={offline} onChange={e=>setOffline(e.target.checked)}/>Sentetik bağlantı kesik</label><GameScreen room={room}/></>;
}
const root=createRoot(document.getElementById('root'));
root.render(<QA/>);
if(import.meta.hot) import.meta.hot.dispose(()=>root.unmount());
