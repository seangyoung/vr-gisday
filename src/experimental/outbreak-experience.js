import * as THREE from 'three';
import { TimedExhibit } from '../showcase/exhibit.js';
import { makeOutbreak, advanceOutbreak, outbreakCounts, outbreakHotspots,
  OUTBREAK_TICK_SECONDS } from './outbreak-model.js';
import { box, sphere, line, panel, action, disposeGroup, lighting } from './visuals.js';

const COLORS={susceptible:0x8dd5cb,infectious:0xffa176,recovered:0x9f9ec2};
const TMP=new THREE.Vector3();
export class OutbreakExperience extends TimedExhibit {
  kind='outbreak';
  constructor(root,onChange,scene) {
    super(root,onChange);
    this.scene=scene; this.seed=24018; this.comparison='distance';
    this.left=makeOutbreak(this.seed); this.right=makeOutbreak(this.seed);
    this.accumulator=0; this.streetSide=null; this.selectedAgent=null;
    this.grips=new Map(); this.controls=[];
    this.table=new THREE.Group(); this.group.add(this.table); lighting(this.table);
    this.world=new THREE.Group(); this.world.visible=false; scene.add(this.world); lighting(this.world);
    this.clipboard=new THREE.Group(); this.clipboard.visible=false; scene.add(this.clipboard);
    lighting(this.clipboard); this.clipboard.scale.setScalar(0.64);
    this.fade=new THREE.Mesh(new THREE.PlaneGeometry(2,2),
      new THREE.MeshBasicMaterial({color:0x071820,transparent:true,opacity:0,
        depthTest:false,depthWrite:false,side:THREE.DoubleSide}));
    this.fade.renderOrder=100;this.fade.visible=false;scene.add(this.fade);
    this.buildTable(); this.buildWorld(); this.buildClipboard();
  }
  buildNeighborhood(parent,side) {
    const g=new THREE.Group(); g.position.x=side==='left'?-0.79:0.79;
    g.position.y=-0.27; g.rotation.x=0.55; parent.add(g);
    box(g,[1.36,0.055,1.12],0x244451,0,0,0);
    for(const axis of [-0.34,0,0.34]) {
      box(g,[1.30,0.008,0.07],0x879696,0,0.038,axis);
      box(g,[0.07,0.008,1.06],0x879696,axis,0.039,0);
    }
    for(let ix=-2;ix<=2;ix++) for(let iz=-1;iz<=1;iz++) {
      if(ix===0&&iz===0) continue;
      const h=0.07+((ix*7+iz*11+25)%5)*0.022;
      box(g,[0.10,h,0.10],0x547a82,ix*0.22,h/2+0.04,iz*0.24);
    }
    const agents=Array.from({length:this.left.agents.length},(_,id)=>{
      const m=sphere(g,0.013,COLORS.susceptible,0,0.064,0);
      m.userData.agent={side,id}; return m;
    });
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.10,0.105,48),
      new THREE.MeshBasicMaterial({color:side==='left'?0x9dd8d0:0xffd180,side:THREE.DoubleSide,
        transparent:true,opacity:0.85}));
    ring.rotation.x=-Math.PI/2; ring.position.y=0.048; g.add(ring);
    const hot=[];
    for(let z=0;z<4;z++) for(let x=0;x<4;x++) {
      const m=box(g,[0.29,0.004,0.24],0xff764c,-0.45+x*0.3,0.042,-0.36+z*0.24,
        {transparent:true,opacity:0}); hot.push(m);
    }
    const contactLines=new THREE.LineSegments(new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({color:0xffdc83,transparent:true,opacity:0.92}));
    g.add(contactLines);
    return {group:g,agents,ring,hot,contactLines};
  }
  buildTable() {
    box(this.table,[3.15,0.07,1.38],0x183842,0,-0.44,0);
    this.board={left:this.buildNeighborhood(this.table,'left'),
      right:this.buildNeighborhood(this.table,'right')};
    this.title=panel('SAME START  •  ONE RULE CHANGES',2.45,0.19,0,0.41,0.04);
    this.table.add(this.title);
    this.readout=panel('',2.62,0.20,0,-0.99,0.07,{fontSize:28});
    this.table.add(this.readout);
    this.chart=panel('',1.14,0.39,0,0.08,-0.45,{fontSize:22});
    this.table.add(this.chart);
    this.contacts=line(this.table,[[0,0,0],[0,0,0]],0xffe5a3); this.contacts.visible=false;
    this.refresh();
  }
  buildWorld() {
    box(this.world,[20,0.03,20],0x294d51,0,-0.03,0);
    for(let i=-2;i<=2;i++) {
      box(this.world,[20,0.005,0.7],0x859390,0,0.005,i*4);
      box(this.world,[0.7,0.005,20],0x859390,i*4,0.006,0);
    }
    for(let x=-8;x<=8;x+=4) for(let z=-8;z<=8;z+=4) {
      if(x===0&&z===0) continue;
      const h=1.3+((x*7+z*3+80)%5)*0.4;
      box(this.world,[2.1,h,2.1],0x69848b,x,h/2,z);
    }
    this.worldAgents=Array.from({length:30},(_,id)=>{
      const g=new THREE.Group(); this.world.add(g);
      box(g,[0.27,0.65,0.18],0x91b6b0,0,0.68,0);
      sphere(g,0.17,0xd6bba0,0,1.16,0);
      g.userData.agent={side:'world',id}; return g;
    });
    this.worldContacts=new THREE.LineSegments(new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({color:0xffdc83,transparent:true,opacity:0.9}));
    this.world.add(this.worldContacts);
  }
  buildClipboard() {
    box(this.clipboard,[0.80,1.13,0.025],0x284d59,0,0,0);
    const text=(s,x,y,w,h)=>{const m=panel(s,w,h,x,y,0.018,{fontSize:24});this.clipboard.add(m);return m;};
    this.clipTitle=text('PAIRED OUTBREAKS',0,0.47,0.73,0.14);
    this.clipStats=text('',0,0.30,0.73,0.16);
    this.clipRule=text('',0,0.11,0.73,0.17);
    this.clipChart=text('',0,-0.10,0.73,0.19);
    this.clipHint=text('Select an agent to see recent contacts.',0,-0.31,0.73,0.13);
    const add=(s,x,y,w,fn)=>this.controls.push(action(this.clipboard,s,x,y,w,0.11,fn));
    add('Contact ring',-0.19,-0.46,0.35,()=>this.setComparison('distance'));
    add('Transmission',0.19,-0.46,0.35,()=>this.setComparison('transmission'));
    add('−',-0.27,-0.59,0.16,()=>this.adjust(-1));
    add('+',-0.07,-0.59,0.16,()=>this.adjust(1));
    add('Step inside',0.20,-0.59,0.35,()=>this.toggleStreet());
    add('Takeaway',0,-0.72,0.70,()=>this.finish());
  }
  begin(){super.begin();this.clipboard.visible=true;}
  setComparison(kind){
    if(!['distance','transmission'].includes(kind))return;
    this.comparison=kind;
    this.resetPair(kind==='distance'?{contactDistance:0.105}:{transmission:0.50});
  }
  adjust(sign){
    const rule=this.comparison==='distance'?
      {contactDistance:Math.max(0.04,Math.min(0.18,this.right.rule.contactDistance+sign*0.02))}:
      {transmission:Math.max(0.08,Math.min(0.85,this.right.rule.transmission+sign*0.12))};
    this.resetPair(rule);
  }
  resetPair(rule){
    this.left=makeOutbreak(this.seed);
    this.right=makeOutbreak(this.seed,rule);
    this.accumulator=0;this.selectedAgent=null;
    this.refresh();
  }
  toggleStreet(cam=this.lastCam){
    if(this.transitionAge!=null)return;
    this.pendingStreetSide=this.streetSide===null?'right':this.streetSide==='right'?'left':null;
    this.transitionAge=0;this.transitionCamera=cam;
  }
  applyStreetSide(cam){
    this.streetSide=this.pendingStreetSide;
    this.table.visible=this.streetSide===null;
    this.world.visible=this.streetSide!==null;
    if(this.streetSide!==null && cam) {
      const p=cam.getWorldPosition(TMP);
      this.world.position.set(p.x,p.y-1.55,p.z-2);
      this.world.rotation.y=cam.getWorldDirection(new THREE.Vector3()).x*0.2;
    }
    if(this.controls[4]){
      const caption=this.streetSide===null?'Step inside':
        this.streetSide==='right'?'Other side':'Back to table';
      this.controls[4].userData.paint(caption);
      this.controls[4].userData.label=caption;
    }
    this.refresh();
    this.onChange?.();
  }
  selectFromRay(ray){
    if(!this.started||this.finished)return false;
    const targets=this.streetSide?this.worldAgents:this.board.left.agents.concat(this.board.right.agents);
    const hit=ray.intersectObjects(targets,true)[0];
    if(!hit)return false;
    const tag=hit.object.userData.agent ?? hit.object.parent?.userData.agent;
    if(!tag)return false;
    this.selectedAgent={side:tag.side==='world'?this.streetSide:tag.side,id:tag.id};
    this.refresh(); return true;
  }
  pointerHit(ray){
    if(!this.started||this.finished)return null;
    return this.streetSide?ray.intersectObjects(this.worldAgents,true)[0]:
      ray.intersectObjects([...this.board.left.agents,...this.board.right.agents],false)[0];
  }
  beginGrip(id,grip,ray){
    if(!this.started||this.finished)return false;
    if(ray&&this.selectFromRay(ray))return true;
    if(this.streetSide||this.comparison!=='distance')return false;
    this.grips.set(id,grip.getWorldPosition(new THREE.Vector3())); return true;
  }
  endGrip(id){
    const hadSpread=this.spreadStart!=null;
    this.grips.delete(id);this.spreadStart=null;
    if(hadSpread)this.resetPair({contactDistance:this.right.rule.contactDistance});
  }
  updateClipboard(grip,cam){
    if(!this.started||this.finished)return;
    cam.updateWorldMatrix(true,false);
    const head=cam.getWorldPosition(new THREE.Vector3());
    const target=grip?.visible?grip.localToWorld(new THREE.Vector3(-0.07,0.04,-0.20)):
      cam.localToWorld(new THREE.Vector3(-0.98,0.01,-1.44));
    const away=target.clone().sub(head);
    if(away.length()<0.95)target.copy(head).addScaledVector(away.normalize(),0.95);
    this.clipboard.position.lerp(target,0.28);
    this.clipboard.lookAt(head);
  }
  refresh(){
    if(this.controls.length>=2){
      this.controls[0].userData.paint('Contact ring',this.comparison==='distance');
      this.controls[1].userData.paint('Transmission',this.comparison==='transmission');
    }
    for(const side of ['left','right']){
      const sim=this[side], board=this.board[side];
      for(let id=0;id<sim.agents.length;id++){
        const a=sim.agents[id], m=board.agents[id];
        m.position.set((a.x-0.5)*1.25,0.066,(a.z-0.5)*1.01);
        m.material.color.setHex(COLORS[a.state]);
        m.scale.setScalar(this.selectedAgent?.side===side&&this.selectedAgent.id===id?1.8:1);
      }
      board.ring.scale.setScalar(sim.rule.contactDistance/0.085);
      const hot=outbreakHotspots(sim);
      for(let i=0;i<hot.length;i++)board.hot[i].material.opacity=hot[i]/18*0.38;
      const segments=[];
      if(this.selectedAgent?.side===side){
        const a=sim.agents[this.selectedAgent.id];
        for(const contact of a.contacts.slice(-8)){
          const b=sim.agents[contact.id];
          segments.push((a.x-0.5)*1.25,0.09,(a.z-0.5)*1.01,
            (b.x-0.5)*1.25,0.09,(b.z-0.5)*1.01);
        }
      }
      board.contactLines.geometry.dispose();
      board.contactLines.geometry=new THREE.BufferGeometry();
      board.contactLines.geometry.setAttribute('position',new THREE.Float32BufferAttribute(segments,3));
    }
    const l=outbreakCounts(this.left),r=outbreakCounts(this.right);
    const count=s=>s.infectious+s.recovered;
    this.readout.userData.paint(`Infected so far: left ${count(l)}  •  right ${count(r)}  /  ${this.left.agents.length}`);
    this.chart.userData.paint(`Paired runs  •  ${Math.round(this.left.tick*OUTBREAK_TICK_SECONDS)} simulated seconds`);
    if(this.clipStats)this.clipStats.userData.paint(`Infected: ${count(l)}  |  ${count(r)}`);
    if(this.clipRule)this.clipRule.userData.paint(this.comparison==='distance'?
      `Right contact radius: ${Math.round(this.right.rule.contactDistance*100)} m\nSpread grips or use ±`:
      `Right chance per contact: ${Math.round(this.right.rule.transmission*100)}%\nUse ± to compare`);
    if(this.clipChart){
      const texture=this.clipChart.material.map,canvas=texture.image,ctx=canvas.getContext('2d');
      ctx.fillStyle='#12313e';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.strokeStyle='#5b8390';ctx.lineWidth=4;ctx.strokeRect(3,3,canvas.width-6,canvas.height-6);
      ctx.fillStyle='#f1fbf6';ctx.textAlign='left';ctx.font='bold 39px system-ui';
      ctx.fillText('INFECTED OVER TIME',22,48);
      ctx.font='bold 26px system-ui';
      ctx.fillStyle='#9de7dc';ctx.fillText('LEFT',24,83);
      ctx.fillStyle='#ffb27e';ctx.fillText('RIGHT',145,83);
      const draw=(history,color)=>{
        ctx.strokeStyle=color;ctx.lineWidth=6;ctx.beginPath();
        history.forEach((v,i)=>{
          const x=26+i/Math.max(1,history.length-1)*(canvas.width-52);
          const y=canvas.height-25-(v.infectious+v.recovered)/this.left.agents.length*(canvas.height-100);
          if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        });ctx.stroke();
      };
      draw(this.left.history,'#9de7dc');draw(this.right.history,'#ffb27e');
      texture.needsUpdate=true;
    }
    if(this.clipHint) {
      const a=this.selectedAgent&&this[this.selectedAgent.side].agents[this.selectedAgent.id];
      this.clipHint.userData.paint(a?`Agent ${a.id+1}: ${a.state}; ${a.contacts.length} recent contacts`:
        'Teal susceptible • orange infectious\nPurple recovered • select an agent');
    }
    if(this.streetSide){
      const agents=this[this.streetSide].agents;
      for(let i=0;i<this.worldAgents.length;i++){
        const a=agents[i];const g=this.worldAgents[i];
        g.position.set((a.x-0.5)*17,0,(a.z-0.5)*17);
        g.children[0].material.color.setHex(COLORS[a.state]);
      }
      const segments=[];
      if(this.selectedAgent?.side===this.streetSide){
        const a=agents[this.selectedAgent.id];
        for(const contact of a.contacts.slice(-8)){
          const b=agents[contact.id];
          segments.push((a.x-0.5)*17,1.0,(a.z-0.5)*17,
            (b.x-0.5)*17,1.0,(b.z-0.5)*17);
        }
      }
      this.worldContacts.geometry.dispose();
      this.worldContacts.geometry=new THREE.BufferGeometry();
      this.worldContacts.geometry.setAttribute('position',new THREE.Float32BufferAttribute(segments,3));
    }
  }
  update(dt,cam,grips){
    super.update(dt); if(!this.started||this.finished)return;
    this.lastCam=cam;
    if(this.transitionAge!=null){
      const before=this.transitionAge;
      this.transitionAge=Math.min(0.48,this.transitionAge+dt);
      this.fade.visible=true;
      const p=cam.getWorldPosition(new THREE.Vector3());
      const f=cam.getWorldDirection(new THREE.Vector3());
      this.fade.position.copy(p).addScaledVector(f,0.45);
      this.fade.quaternion.copy(cam.getWorldQuaternion(new THREE.Quaternion()));
      this.fade.material.opacity=Math.sin(Math.PI*this.transitionAge/0.48)*0.88;
      if(before<0.24&&this.transitionAge>=0.24)this.applyStreetSide(this.transitionCamera??cam);
      if(this.transitionAge>=0.48){this.transitionAge=null;this.fade.visible=false;}
    }
    this.accumulator+=dt;
    let ticks=0;
    while(this.accumulator>=OUTBREAK_TICK_SECONDS&&ticks++<3){
      advanceOutbreak(this.left);advanceOutbreak(this.right);
      this.accumulator-=OUTBREAK_TICK_SECONDS;
    }
    if(ticks>1)this.refresh();
    if(this.grips.size===2&&grips){
      const positions=[...this.grips.keys()].map(id=>grips.get(id)?.getWorldPosition(new THREE.Vector3()));
      if(positions.every(Boolean)){
        const d=positions[0].distanceTo(positions[1]);
        if(this.spreadStart==null)this.spreadStart={d,rule:this.right.rule.contactDistance};
        this.right.rule.contactDistance=Math.max(0.04,Math.min(0.18,this.spreadStart.rule+(d-this.spreadStart.d)*0.08));
        this.refresh();
      }
    }
    const leftGrip=[...grips?.values()??[]].find(g=>g.userData?.xrInput?.handedness==='left');
    this.updateClipboard(leftGrip,cam);
  }
  finish(){super.finish();this.clipboard.visible=false;this.world.visible=false;this.group.visible=false;}
  dispose(){disposeGroup(this.fade);disposeGroup(this.clipboard);disposeGroup(this.world);super.dispose();}
}
