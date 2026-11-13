// Run entrances when their content first enters view. The static document is
// always visible to printing, assistive technology and reduced-motion users.
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const easeOut = 'cubic-bezier(.19,1,.3,1)';
let entrances;
let storyObserver;
let progressFrame = 0;

export function playMotion(element, frames, options) {
  if (!element || reduced.matches || !element.animate) return;
  return element.animate(frames, options);
}

function enter(element) {
  playMotion(element, [
    {opacity:.12, transform:'translateY(26px)'},
    {opacity:1, transform:'translateY(0)'}
  ], {duration:630, easing:easeOut});
  const line = element.querySelector('.trend-stroke');
  if (line) playMotion(line, [
    {strokeDasharray:'1 1', strokeDashoffset:'1'},
    {strokeDasharray:'1 1', strokeDashoffset:'0'}
  ], {duration:1100, easing:easeOut});
  element.querySelectorAll('.track i').forEach((bar, i) => {
    playMotion(bar, [{transform:'scaleX(0)'},{transform:'scaleX(1)'}],
      {duration:650, delay:i*45, fill:'backwards', easing:easeOut});
  });
}

export function observeSections(root) {
  entrances?.disconnect();
  storyObserver?.disconnect();
  if (!('IntersectionObserver' in window)) return;
  entrances = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entrances.unobserve(entry.target);
      enter(entry.target);
    }
  }, {threshold:.1});
  root.querySelectorAll('.below > .panel, .rad-layout > .panel, .method-grid > .panel, .story-head, .story-row').forEach(el=>entrances.observe(el));
  scheduleProgress();
}

export function observeStory(steps, select) {
  storyObserver?.disconnect();
  if (!('IntersectionObserver' in window)) return;
  storyObserver = new IntersectionObserver(entries=>{
    const entering = entries.filter(entry=>entry.isIntersecting);
    if (!entering.length) return;
    const target = innerHeight*.48;
    const nearest=entering.sort((a,b)=>Math.abs(a.boundingClientRect.top-target)-Math.abs(b.boundingClientRect.top-target))[0];
    select(Number(nearest.target.dataset.step));
  }, {rootMargin:'-26% 0px -34% 0px', threshold:0});
  steps.forEach(el=>storyObserver.observe(el));
}

function scheduleProgress() {
  if (progressFrame) return;
  progressFrame = requestAnimationFrame(()=>{
    progressFrame = 0;
    const max=document.documentElement.scrollHeight-innerHeight;
    document.querySelector('.read-progress').style.transform='scaleX('+(max>0?Math.min(1,Math.max(0,scrollY/max)):0)+')';
  });
}
addEventListener('scroll',scheduleProgress,{passive:true});
addEventListener('resize',scheduleProgress,{passive:true});
reduced.addEventListener('change',()=>{
  if(reduced.matches) document.getAnimations().forEach(a=>a.cancel());
});

document.addEventListener('pointerdown', event=>{
  const button = event.target.closest('.hero-action, .action, .timeline-button, .story-jump, .map-actions button, .map-search');
  if (!button || !finePointer.matches || reduced.matches) return;
  const bounds=button.getBoundingClientRect();
  const ripple=document.createElement('span');
  ripple.className='ink-ripple';
  ripple.setAttribute('aria-hidden','true');
  ripple.style.left=(event.clientX-bounds.left)+'px';
  ripple.style.top=(event.clientY-bounds.top)+'px';
  button.append(ripple);
  const wave=playMotion(ripple,[{transform:'translate(-50%,-50%) scale(0)',opacity:.52},
    {transform:'translate(-50%,-50%) scale(1)',opacity:0}],{duration:480,easing:easeOut});
  if(wave)wave.finished.catch(()=>{}).finally(()=>ripple.remove());
  else ripple.remove();
});

export function scrollToElement(element) {
  element?.scrollIntoView({block:'center',behavior:reduced.matches?'instant':'smooth'});
}
