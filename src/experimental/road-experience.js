import * as THREE from 'three';
import { TimedExhibit } from '../showcase/exhibit.js';
import { TOWN_NODES,TOWN_EDGES,fastestRoute,nearestRoadNode,driveStep } from './road-model.js';
import { box,sphere,line,panel,disposeGroup,lighting } from './visuals.js';

const TABLE_SCALE=0.022;
const node=id=>TOWN_NODES[id];
function roadSegment(group,a,b,scale,color,width=2.4,y=0.04){
  const [ax,az]=node(a),[bx,bz]=node(b);
  const dx=(bx-ax)*scale,dz=(bz-az)*scale;
  const m=box(group,[width*scale,0.012,Math.hypot(dx,dz)],color,
    (ax+bx)*scale/2,y,(az+bz)*scale/2);
  m.rotation.y=Math.atan2(dx,dz);return m;
}
export class RoadExperience extends TimedExhibit{
  kind='road';
  constructor(root,onChange,scene){
    super(root,onChange);this.scene=scene;this.phase='table';this.closed=[];
    this.original=fastestRoute();this.closedRoute=this.original;
    this.route=this.original;this.driveTime=0;this.driveDistance=0;
    this.throttle=false;this.brake=false;this.wheelHands=new Map();
    this.table=new THREE.Group();this.group.add(this.table);lighting(this.table);
    this.world=new THREE.Group();this.world.visible=false;scene.add(this.world);lighting(this.world);
    this.cockpit=new THREE.Group();this.cockpit.visible=false;scene.add(this.cockpit);
    lighting(this.cockpit);
    this.buildTable();this.buildWorld();this.buildCockpit();this.refresh();
  }
  buildTown(group,scale,table=false){
    const minX=-59,maxX=59,minZ=-56,maxZ=19;
    box(group,[(maxX-minX)*scale,0.015,(maxZ-minZ)*scale],
      table?0x344d42:0x45644d,0,0,(minZ+maxZ)*scale/2);
    box(group,[15*scale,0.012,(maxZ-minZ)*scale],0x3b83a3,0,0.015,(minZ+maxZ)*scale/2);
    for(const edge of TOWN_EDGES)
      roadSegment(group,edge.a,edge.b,scale,edge.bridge?0xa7a9a2:0x5f6b6c,
        edge.bridge?3.3:3.1,0.042);
    for(const [id,loc] of Object.entries(TOWN_NODES)){
      if(['hospital','patient'].includes(id))continue;
      sphere(group,table?0.025:0.6,0xe5e1b7,loc[0]*scale,0.07,loc[1]*scale);
    }
    const h=node('hospital'),p=node('patient');
    box(group,[8*scale,table?0.24:7,7*scale],0xd6e4e3,
      h[0]*scale,table?0.17:3.5,h[1]*scale);
    box(group,[6*scale,table?0.17:5,6*scale],0xd7a06d,
      p[0]*scale,table?0.14:2.5,p[1]*scale);
    if(!table){
      for(let x=-50;x<=50;x+=12)for(let z=-49;z<=8;z+=13){
        if(Math.abs(x)<13||Math.abs(x+48)<8&&Math.abs(z+28)<10||
          Math.abs(x-48)<8&&Math.abs(z+26)<10)continue;
        const height=3+Math.abs((x*7+z*13)%5);
        box(group,[5,height,5],0x809289,x,height/2,z);
      }
    }
  }
  buildTable(){
    this.table.position.set(0,-0.03,-0.45);
    this.table.rotation.x=0.62;
    this.table.scale.setScalar(0.72);
    box(this.table,[2.96,0.08,2.2],0x16333f,0,-0.08,-0.24);
    this.buildTown(this.table,TABLE_SCALE,true);
    this.routeGroup=new THREE.Group();this.table.add(this.routeGroup);
    this.originalGroup=new THREE.Group();this.originalGroup.visible=false;
    this.table.add(this.originalGroup);
    this.trailGroup=new THREE.Group();this.table.add(this.trailGroup);
    const [bx,bz]=node('bridgeNorthW');
    this.barricade=box(this.table,[0.18,0.10,0.07],0xf8a06b,-1.18,0.16,0.67);
    this.barricade.userData.grabbable=true;
    this.barricadeOriginal=this.barricade.position.clone();
    this.bridgePoint=new THREE.Vector3(0,0.11,bz*TABLE_SCALE);
    this.northBridge=box(this.table,[0.62,0.01,0.13],0x83999a,0,0.09,bz*TABLE_SCALE);
    this.northBridge.material.transparent=true;this.northBridge.material.opacity=0.35;
    this.northBridge.userData.bridge=true;
    this.readout=panel('',2.62,0.19,0,-0.58,0.10,{fontSize:28});
    this.group.add(this.readout);
  }
  buildWorld(){this.buildTown(this.world,1,false);
    this.worldRoute=new THREE.Group();this.world.add(this.worldRoute);
    this.worldBarricade=box(this.world,[6,1.2,1],0xe68a57,0,0.65,-18);
  }
  buildCockpit(){
    box(this.cockpit,[1.3,0.3,0.52],0x22343b,0,-0.72,-0.61);
    box(this.cockpit,[1.45,0.06,0.18],0xb8c8ca,0,-0.57,-0.91);
    this.wheel=new THREE.Group();this.wheel.position.set(0,-0.47,-0.73);
    this.wheel.rotation.x=-0.38;this.cockpit.add(this.wheel);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(0.23,0.026,10,36),
      new THREE.MeshStandardMaterial({color:0x15252b,roughness:0.77}));
    this.wheel.add(rim);
    for(let a=0;a<3;a++){
      const t=a*Math.PI*2/3;
      line(this.wheel,[[0,0,0],[Math.cos(t)*0.22,Math.sin(t)*0.22,0]],0xb7c7c7);
    }
    this.dashboard=panel('',0.48,0.13,0.52,-0.24,-0.95,{fontSize:26});
    this.cockpit.add(this.dashboard);
    const canvas=document.createElement('canvas');canvas.width=480;canvas.height=280;
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    this.dashCanvas=canvas;this.dashTexture=texture;
    this.dashMap=new THREE.Mesh(new THREE.PlaneGeometry(0.48,0.32),
      new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
    this.dashMap.position.set(0.52,-0.48,-0.95);this.cockpit.add(this.dashMap);
  }
  begin(){super.begin();this.phase='table';this.refresh();}
  routeVisual(group,route,scale,color=0xa6f5d9){
    while(group.children.length){const child=group.children[0];group.remove(child);
      child.geometry?.dispose();child.material?.dispose();}
    if(!route)return;
    for(let i=1;i<route.path.length;i++)
      roadSegment(group,route.path[i-1],route.path[i],scale,color,scale===1?0.9:4.2,
        scale===1?0.095:0.11);
  }
  refresh(){
    this.closedRoute=fastestRoute('hospital','patient',this.closed);
    this.route=this.phase==='driving'&&this.route?this.route:this.closedRoute;
    this.routeVisual(this.routeGroup,this.closedRoute,TABLE_SCALE);
    this.routeVisual(this.originalGroup,this.original,TABLE_SCALE,0x83c9f5);
    this.originalGroup.visible=this.phase==='debrief';
    this.routeVisual(this.worldRoute,this.route,1);
    this.worldBarricade.visible=this.closed.includes('north');
    this.barricade.position.copy(this.closed.includes('north')?this.bridgePoint:this.barricadeOriginal);
    this.readout.userData.paint(`Open: ${this.original.minutes.toFixed(2)} min  •  ${this.closed.length?'Closed bridge: '+this.closedRoute.minutes.toFixed(2)+' min':'Drag barricade onto north bridge'}`);
    if(this.dashboard)this.dashboard.userData.paint(`Route ${this.route?.minutes.toFixed(2)??'—'} min  •  ${this.speed?.toFixed(1)??'0.0'} m/s`);
    this.drawDashboard();
    if(this.started)this.onChange?.();
  }
  drawDashboard(){
    if(!this.dashCanvas)return;
    const ctx=this.dashCanvas.getContext('2d'),c=this.dashCanvas;
    ctx.fillStyle='#0e2934';ctx.fillRect(0,0,c.width,c.height);
    const px=x=>24+(x+58)/116*(c.width-48);
    const pz=z=>20+(z+56)/76*(c.height-40);
    const segment=(a,b,color,width)=>{
      const [ax,az]=node(a),[bx,bz]=node(b);
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();
      ctx.moveTo(px(ax),pz(az));ctx.lineTo(px(bx),pz(bz));ctx.stroke();
    };
    ctx.lineCap='round';
    for(const edge of TOWN_EDGES)segment(edge.a,edge.b,
      this.closed.includes(edge.bridge)?'#ff8d76':'#6b9296',6);
    if(this.route)for(let i=1;i<this.route.path.length;i++)
      segment(this.route.path[i-1],this.route.path[i],'#a6f5d9',9);
    for(const [id,color] of [['hospital','#f7f7ed'],['patient','#ffd187']]){
      const [x,z]=node(id);ctx.fillStyle=color;ctx.beginPath();
      ctx.arc(px(x),pz(z),10,0,Math.PI*2);ctx.fill();
    }
    if(this.car){ctx.fillStyle='#ff9d60';ctx.beginPath();
      ctx.arc(px(this.car.x),pz(this.car.z),8,0,Math.PI*2);ctx.fill();}
    this.dashTexture.needsUpdate=true;
  }
  toggleClosure(){
    this.closed=this.closed.includes('north')?[]:['north'];
    this.refresh();
  }
  pointerHit(ray){
    if(!this.started||this.finished)return null;
    return this.phase==='driving'?ray.intersectObject(this.wheel,true)[0]:
      ray.intersectObjects([this.barricade,this.northBridge],false)[0];
  }
  beginGrip(id,grip,ray){
    if(!this.started||this.finished)return false;
    const p=grip.getWorldPosition(new THREE.Vector3());
    if(this.phase==='driving'){
      const wheel=this.wheel.getWorldPosition(new THREE.Vector3());
      if(p.distanceTo(wheel)<0.50){
        this.wheelHands.set(id,{grip,initial:p.clone(),steer:this.steer??0});return true;
      }
      return false;
    }
    if(this.phase!=='table'||this.dragBy!=null)return false;
    const hit=ray.intersectObject(this.barricade)[0];
    if(!hit&&p.distanceTo(this.barricade.getWorldPosition(new THREE.Vector3()))>0.25)return false;
    this.dragBy=id;this.dragGrip=grip;
    this.dragOffset=this.barricade.getWorldPosition(new THREE.Vector3()).sub(p);
    return true;
  }
  endGrip(id){
    this.wheelHands.delete(id);
    if(this.dragBy===id){
      this.dragBy=null;this.dragGrip=null;
      const d=this.barricade.position.distanceTo(this.bridgePoint);
      if(d<0.55)this.closed=['north'];
      this.refresh();
    }
  }
  driveInput(hand,pressed){
    if(this.phase!=='driving')return false;
    if(hand==='right')this.throttle=pressed;
    if(hand==='left')this.brake=pressed;
    return true;
  }
  startDrive(cam){
    if(!this.closed.length)return false;
    this.phase='driving';this.table.visible=false;this.world.visible=true;
    this.readout.visible=false;
    this.cockpit.visible=true;this.driveTime=0;this.driveDistance=0;
    this.car={x:node('hospital')[0],z:node('hospital')[1],heading:Math.PI/2};
    this.speed=0;this.steer=0;this.route=this.closedRoute;
    this.trail=[{x:this.car.x,z:this.car.z}];this.trailAge=0;
    const p=cam.getWorldPosition(new THREE.Vector3());
    this.cockpit.position.copy(p);
    this.worldAnchor=p.clone();this.positionWorld();this.refresh();return true;
  }
  positionWorld(){
    if(!this.car)return;
    this.world.rotation.y=this.car.heading;
    const pos=new THREE.Vector3(this.car.x,0,this.car.z).applyAxisAngle(new THREE.Vector3(0,1,0),this.car.heading);
    this.world.position.set(this.worldAnchor.x-pos.x,this.worldAnchor.y-1.65,this.worldAnchor.z-pos.z);
  }
  returnToTable(){
    if(this.phase!=='driving')return;
    this.phase='debrief';this.table.visible=true;this.world.visible=false;
    this.readout.visible=true;
    this.cockpit.visible=false;this.throttle=this.brake=false;
    while(this.trailGroup.children.length){
      const child=this.trailGroup.children[0];this.trailGroup.remove(child);
      child.geometry.dispose();child.material.dispose();
    }
    if(this.trail?.length>1)
      line(this.trailGroup,this.trail.map(p=>[p.x*TABLE_SCALE,0.16,p.z*TABLE_SCALE]),0xffab73);
    this.refresh();
  }
  update(dt,cam){
    super.update(dt);if(!this.started||this.finished)return;
    if(this.dragBy!=null){
      const p=this.dragGrip.getWorldPosition(new THREE.Vector3()).add(this.dragOffset);
      this.barricade.position.copy(this.table.worldToLocal(p));
      this.barricade.position.y=0.17;
    }
    if(this.phase!=='driving')return;
    this.driveTime+=dt;
    if(this.wheelHands.size){
      let sum=0;
      for(const hand of this.wheelHands.values()){
        const p=hand.grip.getWorldPosition(new THREE.Vector3());
        sum+=hand.steer+(p.x-hand.initial.x)*2.2;
      }
      this.steer=Math.max(-1,Math.min(1,sum/this.wheelHands.size));
    }else this.steer*=Math.max(0,1-dt*2);
    this.wheel.rotation.z=-this.steer*0.65;
    const next=driveStep({...this.car,speed:this.speed},
      {throttle:this.throttle,brake:this.brake,steer:this.steer},dt);
    this.driveDistance+=Math.hypot(next.x-this.car.x,next.z-this.car.z);
    this.car=next;this.speed=next.speed;
    this.trailAge+=dt;
    if(this.trailAge>=0.2){this.trail.push({x:this.car.x,z:this.car.z});this.trailAge=0;}
    this.positionWorld();
    const nearest=nearestRoadNode(this.car.x,this.car.z);
    if(!this.route.path.includes(nearest)){
      const rerouted=fastestRoute(nearest,'patient',this.closed);
      if(rerouted){this.route=rerouted;this.routeVisual(this.worldRoute,this.route,1);this.rerouted=true;}
    }
    this.dashboard.userData.paint(`Route ${this.route?.minutes.toFixed(2)??'—'} min  •  ${this.speed.toFixed(1)} m/s${this.rerouted?'\nRerouted':''}`);
    this.dashAge=(this.dashAge??0)+dt;
    if(this.dashAge>0.2){this.drawDashboard();this.dashAge=0;}
    if(Math.hypot(this.car.x-node('patient')[0],this.car.z-node('patient')[1])<7||this.driveTime>75)
      this.returnToTable();
  }
  finish(){super.finish();this.group.visible=false;this.world.visible=false;this.cockpit.visible=false;}
  dispose(){disposeGroup(this.world);disposeGroup(this.cockpit);super.dispose();}
}
