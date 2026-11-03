import * as THREE from 'three';

export function box(group, size, color, x=0,y=0,z=0, materialOptions={}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size),
    new THREE.MeshBasicMaterial({ color, ...materialOptions }));
  mesh.position.set(x,y,z);
  group.add(mesh);
  return mesh;
}
export function sphere(group, radius, color, x=0,y=0,z=0, materialOptions={}) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius,12,8),
    new THREE.MeshBasicMaterial({ color, ...materialOptions }));
  mesh.position.set(x,y,z); group.add(mesh); return mesh;
}
export function line(group, points, color=0xa6f5d9, width=1) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
  const mesh = new THREE.Line(geometry,new THREE.LineBasicMaterial({color,linewidth:width}));
  group.add(mesh); return mesh;
}
export function lighting(group){
  group.add(new THREE.HemisphereLight(0xe6f8ff,0x50635e,2));
  const sun=new THREE.DirectionalLight(0xffe9c4,2);
  sun.position.set(-3,6,4);group.add(sun);
}
export function panel(text, width, height, x=0,y=0,z=0, options={}) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(512,Math.round(width*600));
  canvas.height = Math.max(256,Math.round(height*600));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width,height),
    new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,transparent:false,
      depthTest: options.depthTest ?? true}));
  mesh.position.set(x,y,z);
  mesh.userData.paint = (value, selected=false) => {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle=selected?'#2e5964':'#12313e'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle=selected?'#9de8ec':'#5b8390'; ctx.lineWidth=5;
    ctx.strokeRect(3,3,canvas.width-6,canvas.height-6);
    ctx.fillStyle='#f1fbf6'; ctx.textAlign='center'; ctx.textBaseline='middle';
    const lines=String(value).split('\n');
    let size=Math.min((options.fontSize ?? 33)*2.35,canvas.height/(lines.length*1.42));
    ctx.font=`600 ${size}px system-ui,sans-serif`;
    for(let i=0;i<lines.length;i++)
      ctx.fillText(lines[i],canvas.width/2,canvas.height/2+(i-(lines.length-1)/2)*size*1.33,canvas.width-25);
    texture.needsUpdate=true;
  };
  mesh.userData.paint(text);
  return mesh;
}
export function action(group, text, x,y,width,height, callback) {
  const m=panel(text,width,height,x,y,0.06,{fontSize:30});
  m.userData.action=callback;
  m.userData.label=text;
  group.add(m);
  return m;
}
export function disposeGroup(group) {
  group.removeFromParent();
  group.traverse(node => {
    node.geometry?.dispose();
    for (const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]) {
      material.map?.dispose(); material.dispose();
    }
  });
}
