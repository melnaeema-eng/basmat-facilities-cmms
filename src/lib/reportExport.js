// Dependency-free XLSX writer: ZIP store method, inline strings, no formula execution.
const encoder=new TextEncoder()
const xml=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'')
function crc32(bytes){
 let crc=0xffffffff
 for(const byte of bytes){
  crc^=byte
  for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)
 }
 return (crc^0xffffffff)>>>0
}
function zip(files){
 const chunks=[],directory=[];let offset=0
 const u16=n=>[n&255,(n>>>8)&255]
 const u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]
 const append=parts=>{for(const part of parts){const bytes=part instanceof Uint8Array?part:new Uint8Array(part);chunks.push(bytes);offset+=bytes.length}}
 for(const [name,contents] of files){
  const filename=encoder.encode(name),body=encoder.encode(contents),crc=crc32(body),start=offset
  append([[80,75,3,4],u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(body.length),u32(body.length),u16(filename.length),u16(0),filename,body])
  directory.push({filename,crc,size:body.length,start})
 }
 const central=offset
 for(const f of directory)append([[80,75,1,2],u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(f.crc),u32(f.size),u32(f.size),u16(f.filename.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(f.start),f.filename])
 const size=offset-central
 append([[80,75,5,6],u16(0),u16(0),u16(directory.length),u16(directory.length),u32(size),u32(central),u16(0)])
 return new Blob(chunks,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
}
function cell(value,column,row){
 const ref=column+row
 if(typeof value==='number'&&Number.isFinite(value))return `<c r="${ref}"><v>${value}</v></c>`
 const text=typeof value==='object'&&value!==null?JSON.stringify(value):value??''
 return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(text)}</t></is></c>`
}
function columnName(index){
 let out='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out
 return out
}
function sheet(rows){
 const body=rows.map((values,i)=>`<row r="${i+1}">${values.map((v,j)=>cell(v,columnName(j),i+1)).join('')}</row>`).join('')
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${body}</sheetData></worksheet>`
}
export function makeWorkbook(sheets){
 const files=[
 ['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
 ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
 ['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name.slice(0,31))}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],
 ['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`],
 ...sheets.map((s,i)=>[`xl/worksheets/sheet${i+1}.xml`,sheet(s.rows)])
 ]
 return zip(files)
}
export function downloadBlob(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement('a')
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove()
 setTimeout(()=>URL.revokeObjectURL(url),1000)
}
export function exportXlsx(report,columns,labels,filename){
 const metadata=[
 ['Field','Value'],['Generated at',report.exported_at||report.generated_at],
 ...Object.entries(report.filters||{}).map(([k,v])=>[k,v??'']),
 ['Definition',report.definition||''],['Rows',report.rows.length],
 ['Note','Live paginated export; rows may change during extraction. Not an accounting snapshot.']
 ]
 const data=[columns.map(c=>labels[c]||c),...report.rows.map(row=>columns.map(c=>row[c]??''))]
 downloadBlob(makeWorkbook([{name:'Report',rows:data},{name:'Metadata',rows:metadata}]),filename+'.xlsx')
}
export function printReport(report,columns,labels,title,lang='en'){
 const win=window.open('','_blank')
 if(!win)throw Error('Allow pop-ups to print the report')
 const doc=win.document
 doc.documentElement.lang=lang;doc.documentElement.dir=lang==='ar'?'rtl':'ltr'
 const style=doc.createElement('style')
 style.textContent='body{font-family:Arial,sans-serif;margin:24px;color:#222}h1{font-size:22px}p{font-size:12px;line-height:1.5}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #ccc;padding:6px;text-align:start;overflow-wrap:anywhere}th{background:#eee}tr{break-inside:avoid}@page{size:A4 landscape;margin:12mm}@media print{button{display:none}}'
 doc.head.appendChild(style)
 doc.title=title
 const h=doc.createElement('h1');h.textContent=title;doc.body.appendChild(h)
 for(const line of [report.filters?.start_date+' — '+report.filters?.end_date,report.definition||'',report.generated_at||'',`Rows: ${report.rows.length}`]){
  const p=doc.createElement('p');p.textContent=line;doc.body.appendChild(p)
 }
 const table=doc.createElement('table'),head=doc.createElement('thead'),tr=doc.createElement('tr')
 for(const col of columns){const th=doc.createElement('th');th.textContent=labels[col]||col;tr.appendChild(th)}
 head.appendChild(tr);table.appendChild(head)
 const body=doc.createElement('tbody')
 for(const row of report.rows){
  const tr=doc.createElement('tr')
  for(const col of columns){const td=doc.createElement('td');const v=row[col];td.textContent=v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v);tr.appendChild(td)}
  body.appendChild(tr)
 }
 table.appendChild(body);doc.body.appendChild(table)
 const button=doc.createElement('button');button.textContent=lang==='ar'?'طباعة / حفظ PDF':'Print / Save PDF';button.onclick=()=>win.print();doc.body.insertBefore(button,table)
 doc.close();win.focus()
}
