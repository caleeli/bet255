import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root element was not found.');
}

app.innerHTML = `
  <main class="shell">
    <section class="hero" aria-labelledby="hero-title">
      <p class="eyebrow">Bet255</p>
      <h1 id="hero-title">Frontend ready for Vercel deployments</h1>
      <p class="lede">
        This Vite application is configured to build into static assets that Vercel can serve globally.
      </p>
      <a class="button" href="https://vercel.com/docs" target="_blank" rel="noreferrer">
        Read Vercel docs
      </a>
    </section>
  </main>
`;
