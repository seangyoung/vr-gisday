// The shipped 161x161 heights and orthomosaic share the same pixel window from
// USGS March 2024 Marconi Beach DSM/RGBavg. Invalid DSM cells remain holes.
export function terrainAt(data, x, z) {
  const c=Math.round((x+85)/data.metersPerCell);
  const r=Math.round((z+85)/data.metersPerCell);
  return data.heights?.[r]?.[c] ?? null;
}
export function terrainMeshData(data, step=1) {
  const n=data.width, width=(n-1)*data.metersPerCell;
  const positions=[], uv=[], indices=[];
  for(let r=0;r<n;r+=step) for(let c=0;c<n;c+=step){
    const h=data.heights[r][c];
    positions.push(c/(n-1)*width-width/2,h??0,r/(n-1)*width-width/2);
    uv.push(c/(n-1),1-r/(n-1));
  }
  const cols=Math.ceil(n/step),rows=Math.ceil(n/step);
  for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){
    const x=c*step,y=r*step;
    if(data.heights[y]?.[x]==null||data.heights[y]?.[(c+1)*step]==null||
      data.heights[(r+1)*step]?.[x]==null||data.heights[(r+1)*step]?.[(c+1)*step]==null)continue;
    const i=r*cols+c;
    indices.push(i,i+cols,i+1,i+1,i+cols,i+cols+1);
  }
  return {positions,uv,indices};
}
export function usefulPhotoOverlap(a,b){
  return a!==b && Math.abs(a-b)<=2;
}
