import Header from "@/components/Header";
import FindCard from "@/components/FindCard";
import { getCollections, getProducts } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [products, collections] = await Promise.all([getProducts(12), getCollections(8)]);
  return (
    <>
      <Header />
      <main>
        <section className="hero hero--fort">
          <div className="hero__scene" aria-hidden="true">
            <div className="hero__skyMotion">
              <img className="hero__approvedCloud hero__approvedCloud--left" src="/fcp-cloud-soft.svg" alt="" />
              <img className="hero__approvedCloud hero__approvedCloud--mid" src="/fcp-cloud-soft.svg" alt="" />
<span className="hero__approvedSun" aria-hidden="true"></span>
              <img className="hero__approvedCloud hero__approvedCloud--rightTop" src="/fcp-cloud-soft.svg" alt="" />
              <img className="hero__approvedCloud hero__approvedCloud--rightLow" src="/fcp-cloud-soft.svg" alt="" />
              <span className="hero__plane" aria-hidden="true">
                <svg className="hero__airTrail" viewBox="0 0 420 120" preserveAspectRatio="none">
                  <path d="M410 68 C335 66 309 96 247 86 C190 77 182 40 128 49 C91 55 76 84 42 79 C25 77 16 69 5 64" />
                  <path d="M408 75 C337 74 307 104 242 94 C180 84 170 52 121 58" />
                </svg>
                <img className="hero__planeArt" src="/fcp-plane-realistic.svg" alt="" />
              </span>
            </div>
            <div className="hero__leftGrass" aria-hidden="true"><img src="/fort-grass-clean.png" alt="" /></div>
            <div className="hero__art">
              <picture>
                <source media="(max-width: 900px)" srcSet="/fort-hero-bg-m.png" />
                <img src="/fort-hero-bg-clean-v43.png" alt="" width="1800" height="654" />
              </picture>
              <span className="hero__blink-eye" aria-hidden="true"></span>
            </div>
          </div>
          <div className="page-width hero__overlay-wrap">
            <div className="hero__copy-card">
              <p className="hero__eyebrow">Cute stuff inside</p>
              <h1 className="hero__title">Crazy Cool <span className="text-pink">Finds</span> You’ll Actually <span className="text-teal">Use</span></h1>
              <p className="hero__subtitle">Clever gadgets, home hacks, family favorites, and gifts that make everyday life easier — and a lot more fun.</p>
              <div className="hero__actions">
                <a href="#finds" className="btn btn--primary">See Today’s Finds →</a>
                <a href="#categories" className="btn btn--outline hero__outline">New Finds</a>
              </div>
            </div>
          </div>
        </section>

        <section id="categories" className="collectionZone"><div className="collectionTitle">⚡ SHOP BY COLLECTION ⚡</div><div className="categoryBar">
          {collections.map((collection) => <a href="#finds" key={collection.id}>{collection.title}</a>)}
        </div></section>

        <section id="finds" className="section">
          <div className="sectionHead">
            <div><p className="kicker">FRESH FROM THE FORT</p><h2>🔥 Crazy-Good Finds</h2></div>
            <a href="#all">See all finds →</a>
          </div>
          <div className="findGrid">
            {products.slice(0,4).map((item) => <FindCard key={item.id} item={item} />)}
          </div>
        </section>

        <section className="featureBand">
          <div>
            <p className="kicker light">ROAD TRIP RESCUES</p>
            <h2>Because “are we there yet?” gets old.</h2>
            <p>Backseat sanity, snack containment and things that buy you another 47 minutes.</p>
            <a className="creamBtn" href="#road">Pack the car →</a>
          </div>
          <div className="roadGraphic">🚙<span>ARE<br/>WE<br/>THERE<br/>YET?</span></div>
        </section>

        <section className="section twoCol">
          <div>
            <div className="sectionHead compact"><div><p className="kicker">HOUSEHOLD CHAOS</p><h2>Why didn't I think of that?</h2></div></div>
            <div className="miniGrid">{products.slice(4,6).map((item) => <FindCard key={item.id} item={item} />)}</div>
          </div>
          <aside className="under25">
            <p className="kicker light">DANGEROUSLY EASY TO JUSTIFY</p>
            <div className="priceMark">UNDER<br/><strong>$25</strong></div>
            <p>The little finds that somehow end up in the cart because, technically, they solve a problem.</p>
            <a className="creamBtn" href="#finds">Show me →</a>
          </aside>
        </section>

        <section id="crazy-list" className="section crazyList">
          <p className="kicker">FRESH OFF THE PRESS</p>
          <div className="sectionHead"><h2>The Crazy List</h2></div>
          <div className="articleGrid">
            <article><span>01</span><p>ROAD TRIPS</p><h3>10 Road Trip Products That Might Actually Save Your Sanity</h3><a href="#">Read the list →</a></article>
            <article><span>02</span><p>DOGS</p><h3>12 Things Your Dog Definitely Doesn't Need (But Will Love)</h3><a href="#">Read the list →</a></article>
            <article><span>03</span><p>SUMMER</p><h3>9 Backyard Finds That Make Home Feel Like Vacation</h3><a href="#">Read the list →</a></article>
          </div>
        </section>

        <section className="newsletter">
          <div><p className="kicker light">THE GOOD STUFF, WITHOUT THE DOOMSCROLL</p><h2>Get the crazy-good finds.</h2><p>A few genuinely useful things in your inbox. No 87-email welcome sequence.</p></div>
          <form><input aria-label="Email address" placeholder="you@email.com"/><button type="button">I'm in</button></form>
        </section>
      </main>
      <footer>
        <a href="/" className="footerLogo" aria-label="Fort Crazypants home"><img src="/fort-crazypants-logo.png" alt="Fort Crazypants — Find Your Next Favorite Thing" /></a>
        <p>Crazy good finds for real family life.</p>
        <p className="disclosure">Fort Crazypants may earn a commission when you buy through some links on this site. It doesn't cost you anything extra.</p>
      </footer>
    </>
  );
}
