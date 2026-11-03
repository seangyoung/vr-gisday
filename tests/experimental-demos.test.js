import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,statSync } from 'node:fs';
import { makeOutbreak,advanceOutbreak,outbreakCounts,OUTBREAK_POPULATION } from
  '../src/experimental/outbreak-model.js';
import { fastestRoute,TOWN_EDGES,TOWN_NODES,driveStep } from '../src/experimental/road-model.js';
import { terrainMeshData,usefulPhotoOverlap } from '../src/experimental/photo-model.js';
import { MARCONI_CAMERAS } from '../src/experimental/marconi-cameras.js';

test('paired outbreak runs reproduce movement and conserve population',()=>{
  const a=makeOutbreak(2024),b=makeOutbreak(2024);
  for(let i=0;i<45;i++){advanceOutbreak(a);advanceOutbreak(b);}
  assert.deepEqual(a,b);
  assert.equal(Object.values(outbreakCounts(a)).reduce((x,y)=>x+y,0),OUTBREAK_POPULATION);
  assert.equal(a.history.length,46);
});
test('changing one contact rule changes only the right-side rule',()=>{
  const left=makeOutbreak(2024),right=makeOutbreak(2024);
  right.rule.contactDistance=0.14;
  assert.equal(right.rule.transmission,left.rule.transmission);
  for(let i=0;i<40;i++){advanceOutbreak(left);advanceOutbreak(right);}
  for(let i=0;i<OUTBREAK_POPULATION;i++){
    assert.equal(left.agents[i].x,right.agents[i].x);
    assert.equal(left.agents[i].z,right.agents[i].z);
  }
  assert.notDeepEqual(left.history,right.history);
});
test('bridge closure reroutes to the remaining crossing with greater time',()=>{
  const original=fastestRoute();const closed=fastestRoute('hospital','patient',['north']);
  assert.ok(original.path.includes('bridgeNorthW'));
  assert.ok(closed.path.includes('bridgeSouthW'));
  assert.ok(!closed.path.includes('bridgeNorthW'));
  assert.ok(closed.minutes>original.minutes);
  assert.ok(TOWN_EDGES.every(e=>TOWN_NODES[e.a]&&TOWN_NODES[e.b]));
});
test('seated drive stays slow, responds to steering and braking',()=>{
  let car={x:-48,z:-28,heading:Math.PI/2,speed:0};
  for(let i=0;i<100;i++)car=driveStep(car,{throttle:true},0.1);
  assert.ok(car.speed>0&&car.speed<=8);
  assert.ok(car.x>-48);
  const turned=driveStep(car,{throttle:true,steer:1},0.1);
  assert.ok(turned.heading>car.heading);
  const stopped=driveStep(turned,{brake:true},0.1);
  assert.ok(stopped.speed<turned.speed);
});
test('photo survey mesh preserves holes and high-overlap pairs',()=>{
  const data={width:3,height:3,metersPerCell:85,
    heights:[[1,2,3],[2,null,4],[3,4,5]]};
  const mesh=terrainMeshData(data);
  assert.equal(mesh.positions.length,27);
  assert.equal(mesh.indices.length,0);
  assert.equal(usefulPhotoOverlap(1,2),true);
  assert.equal(usefulPhotoOverlap(0,5),false);
});
test('bundled Marconi survey patch and source photo subset are present and aligned',()=>{
  const data=JSON.parse(readFileSync(new URL('../public/assets/marconi/terrain.json',import.meta.url)));
  assert.equal(data.width,161);
  assert.equal(data.heights.length,161);
  assert.equal(data.heights[0].length,161);
  assert.deepEqual(data.utm19nTopLeft,[420027.5,4638270]);
  assert.ok(data.heights.flat().some(h=>h===null));
  for(const [x,y] of MARCONI_CAMERAS){
    assert.ok(x>=data.utm19nTopLeft[0]&&x<=data.utm19nTopLeft[0]+180);
    assert.ok(y<=data.utm19nTopLeft[1]&&y>=data.utm19nTopLeft[1]-185);
  }
  for(let i=1;i<=6;i++)
    assert.ok(statSync(new URL(`../public/assets/marconi/photo-${i}.jpg`,import.meta.url)).size>100_000);
  assert.ok(statSync(new URL('../public/assets/marconi/orthomosaic.jpg',import.meta.url)).size>100_000);
});
