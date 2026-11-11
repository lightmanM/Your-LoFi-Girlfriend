import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

// What a search engine or a link preview reads before any script runs: the head of index.html and the files beside it.
const SITE='https://yourlofigirl.com/';
const at=p=>new URL(p,import.meta.url);
const html=readFileSync(at('../index.html'),'utf8');
const meta=(key,name)=>(html.match(new RegExp(`<meta ${key}="${name}" content="([^"]*)">`))||[])[1];

test('the page describes itself to search engines',()=>{
 const title=(html.match(/<title>([^<]*)<\/title>/)||[])[1];
 assert.ok(title.startsWith('Your LoFi Girlfriend')&&title.length<=60,'a title that fits a search result');
 const about=meta('name','description');
 assert.ok(about&&about.length>=70&&about.length<=170,'a description of 70 to 170 characters');
 assert.ok(html.includes(`<link rel="canonical" href="${SITE}">`),'the canonical address');
});

test('a shared link has a title, a line of text and a picture',()=>{
 assert.equal(meta('property','og:title'),'Your LoFi Girlfriend');
 assert.ok(meta('property','og:description'));
 assert.equal(meta('property','og:url'),SITE);
 assert.equal(meta('name','twitter:card'),'summary_large_image');
 const image=meta('property','og:image');
 assert.ok(image.startsWith(SITE),'an absolute address on the site');
 assert.ok(existsSync(at('../public/'+image.slice(SITE.length))),'the picture is in public/');
});

test('robots.txt is a real file that lets crawlers in',()=>{
 const robots=readFileSync(at('../public/robots.txt'),'utf8');
 assert.match(robots,/^User-agent: \*\nAllow: \/\n/);
});

test('the page says what it is with scripts off',()=>{
 const off=(html.match(/<noscript>([\s\S]*?)<\/noscript>/)||[])[1]||'';
 assert.match(off,/lofi companion/);
});
