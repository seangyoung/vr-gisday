export const landingMarkup = `
  <header class="home-header">
    <div class="brand">◈ &nbsp; SPATIAL DISCOVERY LAB</div>
    <div class="tag">GIS Day · UT Southwestern</div>
  </header>
  <main class="home-main">
    <section class="home-intro" aria-labelledby="home-title">
      <div class="eyebrow">Step into geospatial science</div>
      <h1 id="home-title">See what place can tell us.</h1>
      <p>Hands-on VR and mixed reality experiences about satellites, terrain, maps, and how we interpret change.</p>
    </section>
    <div class="home-grid">
      <div class="home-left">
        <div class="launch-actions" aria-label="Explore the lab">
          <button id="vr" disabled>Checking VR…</button>
          <button id="ar" class="secondary" disabled>Checking room scan…</button>
          <button id="videos" class="tertiary">Recommended Videos</button>
        </div>
        <p id="status" role="status" aria-live="polite"></p>
        <section class="creator-card" aria-labelledby="creator-title">
          <div class="creator-identity">
            <div class="creator-monogram" aria-hidden="true">SY</div>
            <div>
              <div class="eyebrow">Created by</div>
              <h2 id="creator-title">Sean G. Young, Ph.D.</h2>
            </div>
          </div>
          <p>Medical geographer and Assistant Professor at UT Southwestern, studying how people and environments shape health across space and time.</p>
          <a class="text-link" href="https://profiles.utsouthwestern.edu/profile/217368/sean-young.html" target="_blank" rel="noopener noreferrer">Faculty profile <span aria-hidden="true">↗</span></a>
        </section>
      </div>
      <section class="certificate-card" aria-labelledby="certificate-title">
        <div class="eyebrow">From curiosity to practice</div>
        <h2 id="certificate-title">Geospatial Public Health Certificate</h2>
        <p>Apply GIS, remote sensing, mapping, and spatial epidemiology to public health questions in UT Southwestern’s 15-credit program.</p>
        <ul class="certificate-topics" aria-label="Program topics">
          <li>GIS + remote sensing</li>
          <li>Spatial epidemiology</li>
          <li>Cartography</li>
          <li>One Health</li>
        </ul>
        <a class="certificate-link" href="https://osph.utsouthwestern.edu/degree-programs/certificate-programs.html#geospatial-public-health" target="_blank" rel="noopener noreferrer">View program details <span aria-hidden="true">↗</span></a>
      </section>
    </div>
  </main>
  <footer>Spatial Discovery Lab · A GIS Day learning experience</footer>
`;
