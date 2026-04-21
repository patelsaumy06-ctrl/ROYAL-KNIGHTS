export default function Avatar({initials, color, size=36}) {
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.33,fontWeight:700,color:"#fff",flexShrink:0}}>
      {initials}
    </div>
  );
}
