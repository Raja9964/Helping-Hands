// GitHub Pages shows 404.html for any missing path. Links such as /track/ or
// /Track?code=... still land on the right page instead of a dead end.
const base = new URL(document.baseURI);
const page = location.pathname.slice(base.pathname.length).replace(/(\.html)?\/*$/i, '').toLowerCase();

if (['track', 'thank-you', 'admin'].includes(page)) {
  location.replace(new URL(`${page}.html${location.search}${location.hash}`, base));
}
