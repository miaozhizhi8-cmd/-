import {encodeName,getText,parseSearch,parseWeb,enrich,type Book} from './search';
export type Status={source:string;ok:boolean;message:string};
export type Result={name:string;page:number;pages:number;total:number|null;books:Book[];web:Book[];statuses:Status[];time:string;searchUrl:string;webUrl:string};
export async function lookupWeb(name:string){
 async function search(query:string){let html:string,provider:string;try{html=await getText('https://www.so.com/s?q='+encodeURIComponent(query),'utf-8',1800);provider='360';const rows=parseWeb(html,name);return {rows,provider}}catch{html=await getText('https://www.bing.com/search?format=rss&q='+encodeURIComponent(query),'utf-8',4500);provider='备用必应';return {rows:parseWeb(html,name),provider}}}
 const jobs=await Promise.allSettled([search('"'+name+'" 小说 主角'),search('"'+name+'"'),search('"'+name+'" 人物 领导 演员 作家')]);
 const web:Book[]=[],sources:string[]=[],failures:string[]=[];const hints=/主席|总统|总理|总书记|领导人|政治人物|政治家|演员|歌手|作家|运动员|科学家|院士|导演|公众人物/;
 jobs.forEach((job,i)=>{if(job.status==='fulfilled'){sources.push(job.value.provider);for(const row of job.value.rows){const source=hints.test(row.title+' '+row.snippet)?'公众人物线索 · '+row.source:row.source;const item={...row,source};const old=web.find(x=>x.id===row.id);if(old){if(source.startsWith('公众人物'))old.source=source}else web.push(item)}}else failures.push(['其他小说','广泛同名','公众人物'][i])});
 return {web,status:{source:'网络',ok:!failures.length,message:jobs.every(x=>x.status==='rejected')?'网络来源未能读取，请重试':'已检索其他小说、广泛同名及公众人物索引（'+[...new Set(sources)].join(' / ')+'）'+(failures.length?'；'+failures.join('、')+'来源读取失败':'')+'；人物身份与完全同名需打开来源核对'},time:new Date().toISOString()}
}
export async function progressive(name:string,page:number,order:string,emit:(event:unknown)=>void){
 const searchUrl='https://www.jjwxc.net/search.php?kw='+encodeName(name)+'&t=4&ord='+order+'&version=1&p='+page;
 const result:Result={name,page,pages:1,total:null,books:[],web:[],statuses:[],time:new Date().toISOString(),searchUrl,webUrl:'https://www.so.com/s?q='+encodeURIComponent('"'+name+'"')};
 try{const parsed=parseSearch(await getText(searchUrl,'gb18030',8000),name);result.pages=parsed.pages;result.total=parsed.total;emit({type:'meta',result});let cursor=0,finished=0;const slots:Book[]=new Array(parsed.books.length);
 await Promise.all(Array.from({length:Math.min(6,parsed.books.length)},async()=>{while(cursor<parsed.books.length){const index=cursor++;slots[index]=await enrich(parsed.books[index],name);finished++;emit({type:'book',book:slots[index],completed:finished,total:parsed.books.length})}}));
 result.books=slots;result.statuses=[{source:'晋江',ok:true,message:'已读取第 '+page+' / '+result.pages+' 页，核对 '+slots.length+' 本完全同名候选；站内共有 '+result.total+' 条搜索结果，包含相近名字'}];
 }catch(e){result.statuses=[{source:'晋江',ok:false,message:e instanceof Error?e.message:'晋江访问失败，请重试'}]}
 result.time=new Date().toISOString();emit({type:'done',result});return result;
}
