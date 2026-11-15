'use client';
import {useState,type FormEvent} from 'react';
import {createBrowserClient} from '@supabase/ssr';
const db=createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
export default function AccountSettings({username}:{username:string}){
 const [name,setName]=useState(username),[currentPassword,setCurrentPassword]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 async function saveName(e:FormEvent){e.preventDefault();setBusy(true);setNotice('');
  try{const {error}=await db.rpc('bst_update_my_username',{p_username:name.trim()});if(error)throw error;setNotice('Đã lưu ID hiển thị.');}
  catch(e){setNotice(e instanceof Error?e.message:'Không thể lưu ID.')}finally{setBusy(false)}
 }
 async function changePassword(e:FormEvent){e.preventDefault();setNotice('');
  if(password.length<8||password!==confirm){setNotice('Mật khẩu mới phải có ít nhất 8 ký tự và xác nhận phải trùng khớp.');return}
  setBusy(true);
  try{
   const {data:{user}}=await db.auth.getUser();if(!user?.email)throw Error('Bạn cần đăng nhập lại.');
   const {error:verifyError}=await db.auth.signInWithPassword({email:user.email,password:currentPassword});
   if(verifyError)throw Error('Mật khẩu hiện tại không chính xác.');
   const {error}=await db.auth.updateUser({password});if(error)throw error;
   setCurrentPassword('');setPassword('');setConfirm('');setNotice('Đã đổi mật khẩu thành công.');
  }catch(e){setNotice(e instanceof Error?e.message:'Không thể đổi mật khẩu.')}finally{setBusy(false)}
 }
 return <section className='bst-v40-panel'><button type='button' className='secondary' aria-expanded={open} onClick={()=>setOpen(!open)}>✎ CHỈNH SỬA TÀI KHOẢN {open?'⌃':'⌄'}</button>
  {open&&<div style={{marginTop:18}}><h2>CHỈNH SỬA THÔNG TIN</h2><form onSubmit={saveName}><label htmlFor='account-username'>ID HIỂN THỊ</label><input id='account-username' required minLength={2} maxLength={40} value={name} onChange={e=>setName(e.target.value)}/><p><button disabled={busy}>LƯU ID HIỂN THỊ</button></p></form>
   <h2>ĐỔI MẬT KHẨU</h2><form onSubmit={changePassword}><label htmlFor='account-old-password'>MẬT KHẨU HIỆN TẠI</label><input id='account-old-password' type='password' autoComplete='current-password' required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/><label htmlFor='account-new-password'>MẬT KHẨU MỚI</label><input id='account-new-password' type='password' autoComplete='new-password' minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/><label htmlFor='account-confirm-password'>XÁC NHẬN MẬT KHẨU MỚI</label><input id='account-confirm-password' type='password' autoComplete='new-password' minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)}/><p><button disabled={busy}>ĐỔI MẬT KHẨU</button></p></form></div>}
  {notice&&<p role='status'>{notice}</p>}
 </section>
}
