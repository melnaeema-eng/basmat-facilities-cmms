import {useEffect,useRef,useState} from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function extractCoordinates(value){
  const s=(value||'').trim()
  if(!s)return null

  const direct=s.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/)
  if(direct)return [Number(direct[1]),Number(direct[2])]

  const patterns=[
    /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    /[?&](?:q|query|ll|destination)=(-?\d{1,2}(?:\.\d+)?)[,%2C\s]+(-?\d{1,3}(?:\.\d+)?)/i,
    /\/(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)(?:[/?]|$)/
  ]
  for(const p of patterns){
    const m=decodeURIComponent(s).match(p)
    if(m)return [Number(m[1]),Number(m[2])]
  }
  return null
}

function valid(lat,lng){
  return Number.isFinite(Number(lat))&&Number(lat)>=-90&&Number(lat)<=90&&
    Number.isFinite(Number(lng))&&Number(lng)>=-180&&Number(lng)<=180
}

export default function SiteGeoFields({form,setForm,lang='en'}){
  const ar=lang==='ar'
  const mapRef=useRef(null)
  const mapInstance=useRef(null)
  const markerRef=useRef(null)
  const [link,setLink]=useState('')
  const [mapOpen,setMapOpen]=useState(false)
  const [message,setMessage]=useState('')

  const lat=form.latitude??''
  const lng=form.longitude??''
  const verified=valid(lat,lng)

  const apply=(a,b,source='manual')=>{
    if(!valid(a,b)){
      setMessage(ar?'الإحداثيات غير صحيحة':'Invalid coordinates')
      return
    }
    setForm(f=>({...f,latitude:String(Number(a)),longitude:String(Number(b)),location_source:'manual'}))
    setMessage(ar?'✓ تم تحديد الموقع الجغرافي':'✓ Geographic location set')
  }

  const fromLink=()=>{
    const coords=extractCoordinates(link)
    if(!coords){
      setMessage(ar
        ?'تعذر استخراج الإحداثيات. استخدم رابط Google Maps الكامل الذي يحتوي على الإحداثيات، أو الصق Latitude, Longitude.'
        :'Could not extract coordinates. Use a full Google Maps URL containing coordinates, or paste Latitude, Longitude.')
      return
    }
    apply(coords[0],coords[1],'link')
  }

  const useCurrent=()=>{
    setMessage('')
    if(!navigator.geolocation){
      setMessage(ar?'GPS غير مدعوم في هذا المتصفح':'GPS is not supported in this browser')
      return
    }
    navigator.geolocation.getCurrentPosition(
      p=>apply(p.coords.latitude,p.coords.longitude,'gps'),
      e=>setMessage((ar?'تعذر تحديد الموقع: ':'Unable to get location: ')+e.message),
      {enableHighAccuracy:true,timeout:15000,maximumAge:0}
    )
  }

  useEffect(()=>{
    if(!mapOpen||!mapRef.current||mapInstance.current)return
    const start=verified?[Number(lat),Number(lng)]:[24.7136,46.6753]
    const map=L.map(mapRef.current).setView(start,verified?16:10)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,
      attribution:'&copy; OpenStreetMap'
    }).addTo(map)
    if(verified)markerRef.current=L.marker(start).addTo(map)
    map.on('click',e=>{
      const {lat:la,lng:lo}=e.latlng
      if(markerRef.current)markerRef.current.setLatLng([la,lo])
      else markerRef.current=L.marker([la,lo]).addTo(map)
      apply(la,lo,'map')
    })
    mapInstance.current=map
    setTimeout(()=>map.invalidateSize(),100)
    return ()=>{
      try{map.remove()}catch{}
      mapInstance.current=null
      markerRef.current=null
    }
  },[mapOpen])

  return <div className="span-2" style={{border:'1px solid #dfe7f0',borderRadius:14,padding:14,marginTop:6}}>
    <h3 style={{marginTop:0}}>{ar?'📍 الموقع الجغرافي':'📍 Geographic Location'}</h3>
    <p className="muted">{ar
      ?'يمكن تحديد الموقع بأحد الخيارات التالية. الموقع النشط يجب أن يحتوي على Latitude و Longitude.'
      :'Choose any method below. An active site must have Latitude and Longitude.'}</p>

    <div className="form-grid">
      <label className="span-2">{ar?'رابط الموقع أو الإحداثيات':'Map link or coordinates'}
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <input style={{flex:1,minWidth:240}} value={link} onChange={e=>setLink(e.target.value)}
            placeholder="https://maps.google.com/...  أو  24.7136, 46.6753"/>
          <button type="button" className="btn secondary" onClick={fromLink}>{ar?'استخراج':'Extract'}</button>
        </div>
      </label>

      <label>Latitude
        <input type="number" step="any" value={lat}
          onChange={e=>setForm(f=>({...f,latitude:e.target.value,location_source:'manual'}))}/>
      </label>
      <label>Longitude
        <input type="number" step="any" value={lng}
          onChange={e=>setForm(f=>({...f,longitude:e.target.value,location_source:'manual'}))}/>
      </label>
    </div>

    <div className="row-actions" style={{marginTop:12,flexWrap:'wrap'}}>
      <button type="button" className="btn primary" onClick={useCurrent}>
        {ar?'📍 استخدام موقعي الحالي':'📍 Use My Current Location'}
      </button>
      <button type="button" className="btn secondary" onClick={()=>setMapOpen(v=>!v)}>
        {mapOpen?(ar?'إغلاق الخريطة':'Close Map'):(ar?'🗺️ تحديد على الخريطة':'🗺️ Pick on Map')}
      </button>
      {verified&&<span className="alert success" style={{margin:0,padding:'8px 12px'}}>
        {ar?'✓ الموقع محدد':'✓ Location set'}
      </span>}
    </div>

    {mapOpen&&<div style={{marginTop:12}}>
      <p className="muted">{ar?'اضغط على المكان المطلوب داخل الخريطة':'Click the required point on the map'}</p>
      <div ref={mapRef} style={{height:330,width:'100%',borderRadius:12,overflow:'hidden'}}/>
    </div>}

    {message&&<div className={message.startsWith('✓')?'alert success':'alert'} style={{marginTop:10}}>{message}</div>}
  </div>
}
