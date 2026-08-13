import Link from "next/link";

export default function Header() {
  return (
    <>
      <div className="announcementBar">
        <span>✨ HANDPICKED FUN & USEFUL FINDS</span>
        <span>💸 DEALS + FINDS WORTH CLICKING</span>
        <span>💙 NEW CRAZY-GOOD FINDS ADDED WEEKLY</span>
      </div>
      <header className="siteHeader">
        <Link href="/" className="brandLogo" aria-label="Fort Crazypants home">
          <img src="/fort-crazypants-logo.png" alt="Fort Crazypants — Find Your Next Favorite Thing" />
        </Link>
        <nav>
          <a href="#finds">Finds</a>
          <a href="#categories">Collections</a>
          <a href="#crazy-list">The Crazy List</a>
          <a href="#about">About</a>
        </nav>
        <a className="headerCta" href="#finds">Find Something Good</a>
      </header>
    </>
  );
}
