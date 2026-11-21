// Render Soultied's original loops before web and iPhone builds so both players use identical masters.
import fs from 'node:fs';
const albums = JSON.parse(fs.readFileSync(new URL('../src/music/shelf.json', import.meta.url)));
const folder = new URL('../public/audio/shelf/', import.meta.url);
fs.mkdirSync(folder, {recursive:true});
const rate = 22050;
const tau = Math.PI * 2;
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const chords = [[0,4,7,11], [-3,0,4,7], [-5,0,4,7], [-7,-3,0,5]];
for (const [style, record] of albums.entries()) {
  for (const [piece, track] of record.tracks.entries()) {
    const frames = rate * track.secs;
    const data = Buffer.alloc(44 + frames * 2);
    data.write('RIFF'); data.writeUInt32LE(data.length - 8,4); data.write('WAVEfmt ',8);
    data.writeUInt32LE(16,16); data.writeUInt16LE(1,20); data.writeUInt16LE(1,22);
    data.writeUInt32LE(rate,24); data.writeUInt32LE(rate*2,28); data.writeUInt16LE(2,32);
    data.writeUInt16LE(16,34); data.write('data',36); data.writeUInt32LE(frames*2,40);
    const root = [55,60,57,53,64][style]+piece*2;
    const beat = [0.75,1,0.6,1.2,0.4][style];
    const motifs = [[0,2,1,3,2,1,0,2],[1,3,2,0,2,3,1,0],[2,1,3,0,1,2,0,3]];
    let seed = 323+piece, rain = 0;
    for(let i=0;i<frames;i++){
      const t=i/rate, step=Math.floor(t/beat), age=t-step*beat;
      const chord=chords[Math.floor(step/8)%4], note=chord[motifs[piece][step%8]];
      const phase=tau*hz(root+note+12)*age;
      const body=Math.sin(phase)+(style===4?0.32:style===2?0.23:0.1)*Math.sin(3*phase)+0.07*Math.sin(2*phase);
      const env=Math.min(1,age/0.012)*Math.exp(-age*(style===2?5.5:3))*Math.min(1,(beat-age)/0.025);
      const barAge=t%(8*beat);
      const pad=chord.reduce((sum,n)=>sum+Math.sin(tau*hz(root+n)*barAge),0)/4;
      const bass=0.20*Math.sin(tau*hz(root+chord[0]-12)*barAge);
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      rain=0.88*rain+0.12*(seed/2147483648-1);
      const texture=style===3?rain*0.4:style===0?0.16*Math.sin(55*tau*age)*Math.exp(-18*age):0;
      const sound=body*env*0.28+(pad*0.23+bass)*Math.min(1,barAge/0.12,(8*beat-barAge)/0.12)+texture;
      data.writeInt16LE(Math.round(28000*sound*Math.min(1,t/0.3,(track.secs-t)/0.6)),44+2*i);
    }
    fs.writeFileSync(new URL(track.slug+'.wav', folder),data);
  }
}
