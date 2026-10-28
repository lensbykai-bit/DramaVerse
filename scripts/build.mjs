import {mkdir, rm, cp} from 'node:fs/promises';
await rm('dist', {recursive:true,force:true});
await mkdir('dist');
for(const path of ['index.html','pay.html','admin.html','css','js','assets','data']) {
  await cp(path,`dist/${path}`,{recursive:true});
}
console.log('Static site built in dist/');
