// script.js - Final Fixed Version

// --- Auth System ---
const Auth = {
  register({name, studentId, password}) {
    if(!name || !studentId || !password) return { ok:false, msg:'Please fill all fields' };
    const users = JSON.parse(localStorage.getItem('da_users') || '[]');
    if(users.some(u => u.studentId === studentId)) return { ok:false, msg:'Student ID already used' };
    users.push({ name, studentId, password });
    localStorage.setItem('da_users', JSON.stringify(users));
    localStorage.setItem('da_current', JSON.stringify({ name, studentId }));
    return { ok:true };
  },
  login({studentId, password}) {
    const users = JSON.parse(localStorage.getItem('da_users') || '[]');
    const u = users.find(x => x.studentId === studentId && x.password === password);
    if(!u) return { ok:false, msg:'Invalid credentials' };
    localStorage.setItem('da_current', JSON.stringify({ name: u.name, studentId: u.studentId }));
    return { ok:true };
  },
  current() {
    return JSON.parse(localStorage.getItem('da_current') || 'null');
  },
  logout() {
    localStorage.removeItem('da_current');
    location.href = 'index.html';
  }
};

// --- Database Helpers ---
function getListings(){
  return JSON.parse(localStorage.getItem('da_listings') || '[]');
}

function saveListings(list){ 
  localStorage.setItem('da_listings', JSON.stringify(list)); 
}

function addListing(item){
  const list = getListings();
  item.id = Date.now(); 
  list.unshift(item); 
  saveListings(list);
}

// --- Publish Handler (The Part That Was Breaking) ---
function handlePublishForm(evt){
  evt.preventDefault();
  const form = evt.target;
  const user = Auth.current();
  
  if (!user) {
    alert("Please log in to sell items.");
    window.location.href = 'login.html';
    return;
  }

  const title = form.title.value.trim();
  const desc = form.description.value.trim();
  const price = Number(form.price.value) || 0;
  const category = form.category.value || 'misc';
  const imgFile = form.media.files[0];

  // If image exists, convert to Base64 (Text) so it saves
  if(imgFile) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = e.target.result; // This is the persistent text version of image
      addListing({ title, desc, price, category, img, studentId: user.studentId });
      finish();
    };
    reader.readAsDataURL(imgFile);
  } else {
    // Save without image
    addListing({ title, desc, price, category, img: '', studentId: user.studentId });
    finish();
  }

  function finish() {
    alert('Item published!');
    form.reset();
    window.location.href = 'listings.html';
  }
}

// --- Initializers ---
function initSell(){
  const form = document.getElementById('sell-form');
  if(form) form.removeEventListener('submit', handlePublishForm); // prevent doubles
  if(form) form.addEventListener('submit', handlePublishForm);
  
  const media = document.getElementById('media');
  const preview = document.getElementById('media-preview');
  if(media && preview) {
    media.addEventListener('change', ()=>{
      const f = media.files[0];
      if(f) preview.innerHTML = `<img src="${URL.createObjectURL(f)}" style="height:100px; border-radius:8px;">`;
    });
  }
}

function initListings(){ 
  if(window.renderListingsPage) window.renderListingsPage(); 
}

function initRegister(){
  const form = document.getElementById('register-form');
  if(form) {
    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const name = form.name.value;
      const studentId = form.studentId.value;
      const password = form.password.value;
      const res = Auth.register({name, studentId, password});
      if(res.ok) window.location.href = 'marketplace.html';
      else alert(res.msg);
    });
  }
}

function initLogin(){
  const form = document.getElementById('login-form');
  if(form) {
    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const studentId = form.studentId.value;
      const password = form.password.value;
      const res = Auth.login({studentId, password});
      if(res.ok) window.location.href = 'marketplace.html';
      else alert(res.msg);
    });
  }
}

// Helper for View button
function handleView(id) {
  alert("Viewing item ID: " + id);
}

// Auto-run
document.addEventListener('DOMContentLoaded', ()=>{
  const page = document.body.getAttribute('data-page');
  if(page === 'sell') initSell();
  if(page === 'listings') initListings();
  if(page === 'register') initRegister();
  if(page === 'login') initLogin();
});