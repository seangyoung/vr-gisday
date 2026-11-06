import * as THREE from 'three';
import { TimedExhibit } from '../showcase/exhibit.js';
import { box, sphere, line, panel, disposeGroup, lighting } from './visuals.js';
import { terrainAtInterpolated, terrainMeshData, usefulPhotoOverlap } from './photo-model.js';
import { MARCONI_CAMERAS } from './marconi-cameras.js';

const BASE=import.meta.env.BASE_URL+'assets/marconi/';
export class PhotoExperience extends TimedExhibit {
  kind='photos';
  constructor(root,onChange,scene){
    super(root,onChange);
    this.scene=scene;this.phase=0;this.selected=[];this.cards=[];
    this.dragBy=null;this.dragCard=null;this.hoverTeleport=null;
    this.assetReady=false;this.world=new THREE.Group();this.world.visible=false;scene.add(this.world);
    lighting(this.world);
    box(this.world,[320,0.04,420],0x245e75,150,-0.72,0);
    this.photoTable=new THREE.Group();this.group.add(this.photoTable);lighting(this.photoTable);
    this.model=new THREE.Group();this.model.visible=false;this.group.add(this.model);
    lighting(this.model);
    this.buildCards();this.buildModelBase();
    this.loadTerrain();
  }
  buildCards(){
    box(this.photoTable,[2.68,0.06,0.04],0x173440,0,0,-0.06);
    const loader=new THREE.TextureLoader();
    for(let i=0;i<6;i++){
      const backing=box(this.photoTable,[0.78,0.60,0.024],0x294b57,
        ((i%3)-1)*0.86,i<3?0.33:-0.34,0);
      backing.userData.photo=i;
      const texture=loader.load(BASE+`photo-${i+1}.jpg`);
      texture.colorSpace=THREE.SRGBColorSpace;
      const image=new THREE.Mesh(new THREE.PlaneGeometry(0.74,0.54),
        new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
      image.position.z=0.014;image.userData.photo=i;backing.add(image);
      this.cards.push(backing);
    }
    this.photoHint=panel('Pick two overlapping photos of the coastal access structure.',2.55,0.18,0,-0.83,0.10,{fontSize:28});
    this.photoTable.add(this.photoHint);
  }
  buildModelBase(){
    box(this.model,[3.0,0.06,3.0],0x214451,0,-0.54,0,
      {transparent:true,opacity:0.48});
    this.model.scale.setScalar(0.64);
    this.model.position.set(0,0.20,-0.62);
    this.model.rotation.x=0.55;
    this.cameraGroup=new THREE.Group();this.model.add(this.cameraGroup);
    this.sparse=new THREE.Points(new THREE.BufferGeometry(),
      new THREE.PointsMaterial({color:0xb5ecdc,size:0.027,sizeAttenuation:true}));
    this.dense=new THREE.Points(new THREE.BufferGeometry(),
      new THREE.PointsMaterial({vertexColors:true,size:0.013,sizeAttenuation:true}));
    this.model.add(this.sparse,this.dense);
    this.coverageModel=new THREE.Group();this.model.add(this.coverageModel);
    this.coverageWorld=new THREE.Group();this.world.add(this.coverageWorld);
    this.coverageMarkers=[];this.coverageNote=null;
    this.surface=null;
  }
  async loadTerrain(){
    try{
      const response=await fetch(BASE+'terrain.json');
      if(!response.ok)throw new Error(`terrain ${response.status}`);
      const data=await response.json();
      if(this.disposed)return;
      this.terrain=data;
      for(const [easting,northing] of MARCONI_CAMERAS){
        const x=(easting-data.utm19nTopLeft[0]-85)*0.017;
        const z=(data.utm19nTopLeft[1]-northing-85)*0.017;
        const y=0.48;
        sphere(this.cameraGroup,0.033,0xffd493,x,y,z);
        line(this.cameraGroup,[[x,y,z],[0.46,-0.24,0.62]],0xffd493);
      }
      sphere(this.cameraGroup,0.055,0x9af5d4,0.46,-0.24,0.62);
      sphere(this.cameraGroup,0.035,0x9af5d4,0.25,-0.30,0.49);
      const raw=terrainMeshData(data);
      const geom=new THREE.BufferGeometry();
      geom.setAttribute('position',new THREE.Float32BufferAttribute(raw.positions,3));
      geom.setAttribute('uv',new THREE.Float32BufferAttribute(raw.uv,2));
      geom.setIndex(raw.indices);geom.computeVertexNormals();
      const tex=new THREE.TextureLoader().load(BASE+'orthomosaic.jpg');
      tex.colorSpace=THREE.SRGBColorSpace;
      const material=new THREE.MeshStandardMaterial({map:tex,side:THREE.DoubleSide,
        roughness:1,metalness:0});
      this.surface=new THREE.Mesh(geom,material);
      this.surface.scale.setScalar(0.017);
      this.surface.position.y=-0.53;
      this.model.add(this.surface);
      const worldMesh=new THREE.Mesh(geom.clone(),material.clone());
      worldMesh.material.map=tex;
      worldMesh.material.side=THREE.DoubleSide;
      this.world.add(worldMesh);this.worldSurface=worldMesh;
      const contact=terrainMeshData(data,2);
      const contactGeometry=new THREE.BufferGeometry();
      contactGeometry.setAttribute('position',
        new THREE.Float32BufferAttribute(contact.positions,3));
      contactGeometry.setIndex(contact.indices);
      // Use a 161-by-161 mesh for controller rays; the visible surface keeps full detail.
      this.collider=new THREE.Mesh(contactGeometry,
        new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
      this.collider.matrixAutoUpdate=false;
      for(let r=24;r<data.height-24;r+=18)for(let c=24;c<data.width-24;c+=18){
        if(this.coverageMarkers.length>=8)break;
        const h=data.heights[r][c];
        if(h==null)continue;
        if(data.heights[r][c+8]!=null&&data.heights[r+8][c]!=null)continue;
        const x=c/(data.width-1)*170-85,z=r/(data.height-1)*170-85;
        const local=sphere(this.coverageModel,0.055,0xffa0af,x*0.017,
          -0.48+h*0.017,z*0.017);
        const world=sphere(this.coverageWorld,0.65,0xffa0af,x,h+0.35,z,
          {transparent:true,opacity:0.72});
        local.userData.coverage=world.userData.coverage=true;
        this.coverageMarkers.push(local,world);
      }
      const sparse=[],dense=[],colors=[];
      const colorImage=await new Promise((resolve,reject)=>{
        const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=BASE+'orthomosaic.jpg';
      });
      if(this.disposed)return;
      const cv=document.createElement('canvas');cv.width=cv.height=512;
      const ctx=cv.getContext('2d');ctx.drawImage(colorImage,0,0,512,512);
      const rgba=ctx.getImageData(0,0,512,512).data;
      for(let r=0;r<data.height;r+=2)for(let c=0;c<data.width;c+=2){
        const h=data.heights[r][c];if(h==null)continue;
        const x=(c/(data.width-1)*170-85)*0.017;
        const z=(r/(data.height-1)*170-85)*0.017;
        let hash=(Math.imul(r+1,73856093)^Math.imul(c+1,19349663))>>>0;
        hash^=hash>>>16;hash=Math.imul(hash,0x7feb352d);hash^=hash>>>15;
        const jitterX=((hash&255)/255-0.5)*0.008;
        const jitterZ=(((hash>>>8)&255)/255-0.5)*0.008;
        const point=[x+jitterX,-0.53+h*0.017,z+jitterZ];
        dense.push(...point);
        const u=Math.floor(c/(data.width-1)*511),v=Math.floor(r/(data.height-1)*511);
        const k=(v*512+u)*4;
        colors.push(rgba[k]/255,rgba[k+1]/255,rgba[k+2]/255);
        if((hash&255)<20)sparse.push(...point);
      }
      this.sparse.geometry.setAttribute('position',new THREE.Float32BufferAttribute(sparse,3));
      this.dense.geometry.setAttribute('position',new THREE.Float32BufferAttribute(dense,3));
      this.dense.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
      this.assetReady=true;this.setPhase(this.phase);
    }catch(error){
      this.assetError=error.message;this.onChange?.();
    }
  }
  begin(){super.begin();this.setPhase(0);}
  setPhase(phase){
    this.phase=phase;
    this.photoTable.visible=phase===0;
    this.model.visible=phase>=1&&phase<5;
    this.world.visible=phase===5;
    this.cameraGroup.visible=phase===1;
    this.sparse.visible=phase===2;
    this.dense.visible=phase===3;
    this.coverageModel.visible=phase===4;
    this.coverageWorld.visible=phase===5;
    if(this.surface){
      this.surface.visible=phase===1||phase===4;
      this.surface.material.transparent=phase===1;
      this.surface.material.opacity=phase===1?0.38:1;
      this.surface.material.needsUpdate=true;
    }
    this.onChange?.();
  }
  advance(cam){
    if(this.phase===0&&this.selected.length<2)return false;
    if(this.phase===0&&!usefulPhotoOverlap(...this.selected))return false;
    if(this.phase===4){this.enterWorld(cam);return true;}
    if(this.phase<4){this.setPhase(this.phase+1);return true;}
    return false;
  }
  selectFromRay(ray){
    if(!this.started||this.finished)return false;
    if(this.phase>=4){
      const active=this.phase===4?this.coverageModel.children:this.coverageWorld.children;
      const hit=ray.intersectObjects(active,false)[0];
      if(!hit)return false;
      this.coverageNote='Pink marker: survey edge or missing DSM cells. More overlapping views improve coverage.';
      this.onChange?.();return true;
    }
    if(this.phase!==0)return false;
    const hit=ray.intersectObjects(this.cards,true)[0];
    if(!hit)return false;
    const id=hit.object.userData.photo??hit.object.parent?.userData.photo;
    if(id==null)return false;
    this.selected=this.selected.includes(id)?this.selected.filter(i=>i!==id):[...this.selected.slice(-1),id];
    for(let i=0;i<this.cards.length;i++)this.cards[i].material.color.setHex(this.selected.includes(i)?0x68bcd0:0x294b57);
    this.photoHint.userData.paint(this.selected.length===2?
      usefulPhotoOverlap(...this.selected)?
        `Photos ${this.selected[0]+1} and ${this.selected[1]+1}: shared features align. Continue.`:
        'Try photographs taken closer together for stronger overlap.':
      'Pick two overlapping photos of the coastal access structure.');
    this.onChange?.();return true;
  }
  pointerHit(ray){
    if(!this.started||this.finished)return null;
    if(this.phase===0)return ray.intersectObjects(this.cards,true)[0];
    if(this.phase===4)return ray.intersectObject(this.surface,false)[0];
    if(this.phase===5)return this.surfaceHit(ray);
    return null;
  }
  surfaceHit(ray){
    if(!this.collider)return null;
    this.world.updateWorldMatrix(true,false);
    this.collider.matrixWorld.copy(this.world.matrixWorld);
    return ray.intersectObject(this.collider,false)[0]??null;
  }
  beginGrip(ray,id,grip){
    if(this.phase!==0||this.dragBy!=null)return false;
    const hit=ray.intersectObjects(this.cards,true)[0];if(!hit)return false;
    this.dragCard=hit.object.userData.photo!=null?hit.object:hit.object.parent;
    this.dragBy=id;
    const p=grip.getWorldPosition(new THREE.Vector3());
    this.dragOffset=this.dragCard.getWorldPosition(new THREE.Vector3()).sub(p);
    return true;
  }
  endGrip(id){if(this.dragBy===id){this.dragBy=null;this.dragCard=null;}}
  enterWorld(cam){
    if(!this.assetReady)return;
    this.setPhase(5);
    const p=cam.getWorldPosition(new THREE.Vector3());
    // Start on surveyed high ground, looking across the bluff toward the shore.
    // The crop center borders a no-data gap and gives an awkward first view.
    const startX=0,startZ=-42.5;
    const h=terrainAtInterpolated(this.terrain,startX,startZ)??16;
    this.world.rotation.y=Math.PI/2;
    const anchor=new THREE.Vector3(startX,0,startZ).applyAxisAngle(
      new THREE.Vector3(0,1,0),this.world.rotation.y);
    this.world.position.set(p.x-anchor.x,p.y-1.6-h,p.z-anchor.z);
  }
  turn(angle,cam){
    if(this.phase!==5||!angle)return;
    const eye=cam.getWorldPosition(new THREE.Vector3());
    const offset=this.world.position.clone().sub(eye)
      .applyAxisAngle(new THREE.Vector3(0,1,0),angle);
    this.world.position.x=eye.x+offset.x;
    this.world.position.z=eye.z+offset.z;
    this.world.rotation.y+=angle;
  }
  walk(stickX,stickY,dt,cam){
    if(this.phase!==5||!this.assetReady||!this.started||this.finished||dt<=0)return;
    const magnitude=Math.hypot(stickX,stickY);
    if(!Number.isFinite(magnitude)||magnitude<0.18)return;
    const direction=cam.getWorldDirection(new THREE.Vector3());
    direction.y=0;direction.normalize();
    const distance=2.8*Math.min(1,(magnitude-0.18)/0.82)*Math.min(dt,0.1)/magnitude;
    const dx=(-direction.z*stickX-direction.x*stickY)*distance;
    const dz=(direction.x*stickX-direction.z*stickY)*distance;
    const eye=cam.getWorldPosition(new THREE.Vector3());
    const local=this.world.worldToLocal(eye.clone());
    const delta=new THREE.Vector3(dx,0,dz)
      .applyAxisAngle(new THREE.Vector3(0,1,0),-this.world.rotation.y);
    const nextX=local.x+delta.x,nextZ=local.z+delta.z;
    const from=terrainAtInterpolated(this.terrain,local.x,local.z);
    const to=terrainAtInterpolated(this.terrain,nextX,nextZ);
    // Keep the visitor on mapped ground and avoid abrupt bluff or survey-edge steps.
    if(from==null||to==null||Math.abs(to-from)>0.45)return;
    this.world.position.x-=dx;
    this.world.position.z-=dz;
    this.world.position.y+=from-to;
  }
  aimTeleport(ray){
    if(this.phase!==5||!this.worldSurface)return false;
    const hit=this.surfaceHit(ray);
    if(!hit){this.hoverTeleport=null;return false;}
    const local=this.world.worldToLocal(hit.point.clone());
    if(local.y<8){this.hoverTeleport=null;return false;}
    this.hoverTeleport=hit.point.clone();return true;
  }
  commitTeleport(cam){
    if(!this.hoverTeleport)return false;
    const p=cam.getWorldPosition(new THREE.Vector3());
    const delta=p.clone().add(new THREE.Vector3(0,-1.6,0)).sub(this.hoverTeleport);
    this.world.position.add(delta);this.hoverTeleport=null;return true;
  }
  teleportCandidate(ray,uiHit=null){
    if(this.phase!==5||!this.worldSurface)return null;
    const hit=this.surfaceHit(ray);
    if(!hit||uiHit&&uiHit.distance<hit.distance)return null;
    const local=this.world.worldToLocal(hit.point.clone());
    const height=terrainAtInterpolated(this.terrain,local.x,local.z);
    const point=height==null?hit.point.clone():
      this.world.localToWorld(new THREE.Vector3(local.x,height,local.z));
    return {point,distance:hit.distance,valid:height!=null&&height>=8};
  }
  teleportTo(candidate,cam){
    if(!candidate?.valid)return false;
    this.hoverTeleport=candidate.point.clone();
    return this.commitTeleport(cam);
  }
  update(dt,cam,grips){
    super.update(dt);
    if(this.dragBy!=null&&this.dragCard){
      const grip=grips?.get(this.dragBy);
      if(!grip?.visible){this.endGrip(this.dragBy);return;}
      const world=grip.getWorldPosition(new THREE.Vector3()).add(this.dragOffset);
      this.dragCard.position.copy(this.photoTable.worldToLocal(world));
      this.dragCard.position.z=0.02;
    }
  }
  finish(){super.finish();this.group.visible=false;this.world.visible=false;}
  dispose(){
    this.disposed=true;
    this.collider?.geometry.dispose();this.collider?.material.dispose();
    disposeGroup(this.world);super.dispose();
  }
}
