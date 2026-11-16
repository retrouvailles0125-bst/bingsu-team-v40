'use client';
import {useRouter} from 'next/navigation';
import {useEffect,useState} from 'react';
import styles from './universe.module.css';

const houses=[
 {id:'treasury',name:'Ngân Khố',image:'/universe/ngan-kho.png',href:'/tracking',description:'Donate và thống kê'},
 {id:'guild',name:'Thương Hội',image:'/universe/thuong-hoi.png',href:'/star',description:'Ngôi Sao May Mắn'},
 {id:'residence',name:'Tư Dinh',image:'/universe/tu-dinh.png',href:'/account',description:'Tài khoản của tôi'},
 {id:'teahouse',name:'Trà Thất',image:'/universe/tra-that.png',href:'/love',description:'Yêu thương gửi Trang'},
 {id:'embassy',name:'Sứ Quán',image:'/universe/su-quan.png',href:'/embassy',description:'Các Project từng thực hiện'}
] as const;

export default function UniverseMap(){
 const router=useRouter();
 const [leaving,setLeaving]=useState(false);
 const [selected,setSelected]=useState('');
 const [loaded,setLoaded]=useState<Record<string,boolean>>({});
 useEffect(()=>{
  let active=true;
  const assets=[{id:'background',src:'/universe/background.png'},...houses.map(h=>({id:h.id,src:h.image}))];
  assets.forEach(asset=>{
   const img=new window.Image();
   img.onload=()=>{if(active)setLoaded(prev=>({...prev,[asset.id]:true}))};
   img.onerror=()=>{if(active)setLoaded(prev=>({...prev,[asset.id]:false}))};
   img.src=asset.src;
  });
  return ()=>{active=false};
 },[]);
 function go(href:string,id:string){
  if(leaving)return;
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){router.push(href);return;}
  setSelected(id);setLeaving(true);
  window.setTimeout(()=>router.push(href),340);
 }
 return <main className={styles.root} aria-label="Bản đồ BST Universe">
  <div className={styles.viewport}>
   <div className={styles.map+(leaving?' '+styles.leaving:'')}>
    <div className={styles.fallbackMap} aria-hidden="true"><div className={styles.fallbackLogo}>BST<br/>UNIVERSE<small>ALL FOR TRANGPHAP</small></div><div className={styles.roadOne}/><div className={styles.roadTwo}/><div className={styles.roadThree}/></div>
    {loaded.background && <img className={styles.background} src="/universe/background.png" alt="Bản đồ BST Universe với các con đường màu hồng" />}
    {houses.map(h=><button type="button" key={h.id} className={styles.house+' '+styles[h.id]+(selected===h.id?' '+styles.selected:'')} onClick={()=>go(h.href,h.id)} disabled={leaving} aria-label={h.name+' — '+h.description} title={h.name+' — '+h.description}>
     {loaded[h.id] ? <img src={h.image} alt="" draggable={false}/> : <span className={styles.fallbackHouse}><span aria-hidden="true">⌂</span><strong>{h.name.toUpperCase()}</strong></span>}<span className={styles.tooltip}>{h.description}</span>
    </button>)}
   </div>
  </div>
  <div className={styles.accessibleNav} aria-label="Các khu vực BST Universe">{houses.map(h=><a key={h.id} href={h.href}>{h.name}</a>)}</div>
 </main>
}
