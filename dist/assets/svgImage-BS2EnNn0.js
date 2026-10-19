const h=["fill","fill-opacity","stroke","stroke-opacity","opacity","font-family","font-size","font-weight","font-style","letter-spacing"];function b(r){const o=r.cloneNode(!0),s=[r,...Array.from(r.querySelectorAll("*"))],e=[o,...Array.from(o.querySelectorAll("*"))],n=new Set;return s.forEach((t,c)=>{const a=e[c];if(!(a instanceof SVGElement))return;const l=getComputedStyle(t),f=[];for(const u of h){const i=l.getPropertyValue(u);i&&f.push(`${u}:${i}`)}(t.tagName==="text"||t.tagName==="tspan")&&(n.add(l.fontFamily),l.textTransform==="uppercase"&&!a.querySelector("*")&&(a.textContent=(a.textContent??"").toUpperCase())),a.setAttribute("style",f.join(";")),a.removeAttribute("class")}),o.querySelectorAll("title").forEach(t=>t.remove()),{clone:o,families:n}}const p=new Map;function S(r){let o=p.get(r);return o||(o=fetch(r).then(s=>s.ok?s.blob():Promise.reject(new Error("font"))).then(s=>new Promise((e,n)=>{const t=new FileReader;t.onload=()=>e(String(t.result)),t.onerror=()=>n(t.error),t.readAsDataURL(s)})),p.set(r,o),o.catch(()=>p.delete(r))),o}async function R(r){const o=new Set;for(const n of r)for(const t of n.split(","))o.add(t.trim().replace(/^["']|["']$/g,"").toLowerCase());const s=Array.from(document.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis.com"]')).map(n=>n.href),e=[];for(const n of new Set(s)){let t="";try{t=await(await fetch(n)).text()}catch{continue}for(const c of t.match(/@font-face\s*{[^}]*}/g)??[]){const a=/font-family:\s*['"]?([^;'"]+)/.exec(c)?.[1]?.trim().toLowerCase();if(!a||!o.has(a))continue;const l=/unicode-range:\s*([^;]+)/.exec(c)?.[1]??"";if(l&&!/U\+0000-00FF/i.test(l))continue;const f=/url\(([^)]+)\)/.exec(c)?.[1]?.replace(/^["']|["']$/g,"");if(f)try{const u=await S(f);e.push(c.replace(/url\([^)]+\)/,`url(${u})`))}catch{}}}return e.join(`
`)}async function $(r,o,s){const{clone:e,families:n}=b(r);e.setAttribute("xmlns","http://www.w3.org/2000/svg"),e.setAttribute("width",String(Math.round(o))),e.setAttribute("height",String(Math.round(s))),e.removeAttribute("style");const t=await R(n);if(t){const c=document.createElementNS("http://www.w3.org/2000/svg","style");c.textContent=t,e.insertBefore(c,e.firstChild)}return new XMLSerializer().serializeToString(e)}function j(r){return new Promise((o,s)=>{const e=URL.createObjectURL(new Blob([r],{type:"image/svg+xml;charset=utf-8"})),n=new Image;n.onload=()=>{window.setTimeout(()=>{o(n),URL.revokeObjectURL(e)},120)},n.onerror=()=>{URL.revokeObjectURL(e),s(new Error("The seating plan couldn’t be turned into a picture."))},n.src=e})}function x(r,o){const s=URL.createObjectURL(r),e=document.createElement("a");e.href=s,e.download=o,document.body.appendChild(e),e.click(),e.remove(),window.setTimeout(()=>URL.revokeObjectURL(s),4e3)}function C(r,o,s){return new Promise((e,n)=>r.toBlob(t=>t?e(t):n(new Error("TOO_BIG")),o,s))}async function L(r,o,s,e=300){const n=new Uint8Array(await r.arrayBuffer()),t=+(o*72/e).toFixed(2),c=+(s*72/e).toFixed(2),a=new TextEncoder,l=[],f=[];let u=0;const i=m=>{const g=typeof m=="string"?a.encode(m):m;l.push(g),u+=g.length},d=(m,g)=>{f[m]=u,i(`${m} 0 obj
${g}
endobj
`)};i(`%PDF-1.4
%âãÏÓ
`),d(1,"<< /Type /Catalog /Pages 2 0 R >>"),d(2,"<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),d(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${t} ${c}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),f[4]=u,i(`4 0 obj
<< /Type /XObject /Subtype /Image /Width ${o} /Height ${s} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${n.length} >>
stream
`),i(n),i(`
endstream
endobj
`);const w=`q ${t} 0 0 ${c} 0 0 cm /Im0 Do Q`;d(5,`<< /Length ${w.length} >>
stream
${w}
endstream`);const y=u;return i(`xref
0 6
0000000000 65535 f 
${[1,2,3,4,5].map(m=>`${String(f[m]).padStart(10,"0")} 00000 n 
`).join("")}`),i(`trailer
<< /Size 6 /Root 1 0 R >>
startxref
${y}
%%EOF
`),new Blob(l,{type:"application/pdf"})}export{$ as a,C as c,x as d,L as j,j as s};
