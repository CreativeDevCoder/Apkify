// iframe sandbox (tanpa allow-same-origin) melarang localStorage -> sediakan pengganti di memori
const SHIM = `<script>try{localStorage.getItem('x')}catch(e){var m={};Object.defineProperty(window,'localStorage',{value:{getItem:function(k){return k in m?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},clear:function(){m={}},key:function(i){return Object.keys(m)[i]||null},get length(){return Object.keys(m).length}}})}</script>`;

export function previewDoc(html = '') {
  const i = html.search(/<head[^>]*>/i);
  if (i >= 0) {
    const end = html.indexOf('>', i) + 1;
    return html.slice(0, end) + SHIM + html.slice(end);
  }
  return SHIM + html;
}
