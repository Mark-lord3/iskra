import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {getSeo,indexableSeoPaths} from '../../shared/seo.js';

test('French covers all shared UI keys with identical interpolation tokens',()=>{
  const source=fs.readFileSync(new URL('../src/i18n.jsx',import.meta.url),'utf8');
  const en=vm.runInNewContext(source.slice(source.indexOf('const en='),source.indexOf("Object.assign(en,{'language.fr'"))+';en');
  const fr=JSON.parse(fs.readFileSync(new URL('../src/i18n-fr.json',import.meta.url),'utf8'));
  for(const [key,value] of Object.entries(en)){
    assert.ok(fr[key],`Missing French key: ${key}`);
    const tokens=s=>[...s.matchAll(/\{\w+\}/g)].map(m=>m[0]).sort();
    assert.deepEqual(tokens(fr[key]),tokens(value),`Interpolation mismatch: ${key}`);
  }
});
test('every public route has French metadata',()=>{
  for(const path of indexableSeoPaths()){
    assert.notEqual(getSeo(path,'fr').description,getSeo(path,'en').description,path);
  }
});
