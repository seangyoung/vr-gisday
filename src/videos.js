// These are provider-hosted 360° videos. Keep playback with the publisher:
// YouTube does not expose these streams for use as a WebXR VideoTexture.
export const recommendedVideos = [
  {
    id: "PnfJDgS9VZc",
    title: "Everest — 360° aerial trailer",
    place: "Himalayas, Nepal",
    duration: "1:44",
    theme: "Topography & elevation",
    prompt: "How does an aerial viewpoint change the way you read ridges, valleys, and elevation?",
    source: "https://www.airpano.com/360video/vr-everest-short/",
  },
  {
    id: "oWF5FN76D4U",
    title: "Bryce Canyon, Part I",
    place: "Utah, United States",
    duration: "1:19",
    theme: "Landforms & erosion",
    prompt: "Look for the shapes that water and weather have carved into the plateau.",
    source: "https://www.airpano.com/360video/video-bryce-canyon-1/",
  },
  {
    id: "kvtS7d48orE",
    title: "Times Square, New York",
    place: "New York, United States",
    duration: "1:27",
    theme: "Urban form & street views",
    prompt: "What can a street-level view show that an overhead map cannot?",
    source: "https://www.airpano.com/360video/video-times-square/",
  },
  {
    id: "Rh2NC2rknTA",
    title: "Windmills of Holland, Part II",
    place: "The Netherlands",
    duration: "1:45",
    theme: "Drainage & land reclamation",
    prompt: "Find the channels and engineered features that manage water in this landscape.",
    source: "https://www.airpano.com/360video/Video-Holland-Windmills-2/",
  },
  {
    id: "GrbF3rnLQTU",
    title: "Canaima Lagoon: Ucaima Waterfall",
    place: "Venezuela",
    duration: "1:08",
    theme: "Rivers & watersheds",
    prompt: "Trace the water through the scene. Where does it converge and where does it go?",
    source: "https://www.airpano.com/360video/video-canaima-lagoon-1/",
  },
];

export function initRecommendedVideos(app) {
  const homeNodes = [...app.children];
  const page = document.createElement("main");
  page.id = "video-page";
  page.hidden = true;
  app.append(page);

  function render() {
    const route = location.hash.match(/^#videos(?:\/([A-Za-z0-9_-]+))?$/);
    const video = route?.[1] && recommendedVideos.find((item) => item.id === route[1]);
    const showingVideos = Boolean(route);
    homeNodes.forEach((node) => { node.hidden = showingVideos; });
    page.hidden = !showingVideos;
    if (!showingVideos) {
      page.replaceChildren(); // Unload the embedded player and stop its audio.
      document.title = "Spatial Discovery Lab — GIS Day";
      return;
    }

    document.title = `${video ? video.title : "Recommended Videos"} — Spatial Discovery Lab`;
    page.innerHTML = `<header class="video-header"><a class="brand" href="#">◈ &nbsp; SPATIAL DISCOVERY LAB</a><span class="tag">GIS Day · 360° videos</span></header>`;
    const content = document.createElement("div");
    page.append(content);
    if (video) {
      content.innerHTML = `<nav class="video-breadcrumb"><a href="#videos">← All recommended videos</a></nav>
        <div class="eyebrow">${video.theme} · ${video.duration}</div>
        <h1>${video.title}</h1><p class="video-place">${video.place}</p>
        <div class="video-player"><iframe title="${video.title} — 360° preview" src="https://www.youtube-nocookie.com/embed/${video.id}?rel=0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
        <p class="video-question">${video.prompt}</p>
        <div class="video-actions"><a class="video-primary" href="https://www.youtube.com/watch?v=${video.id}" target="_blank" rel="noopener noreferrer">Open 360° video for immersive viewing ↗</a><a class="video-secondary" href="${video.source}" target="_blank" rel="noopener noreferrer">View on AirPano ↗</a></div>
        <p class="video-help">On Quest, open the video in YouTube VR and choose immersive mode for the full 360° view. The link opens YouTube; the headset decides whether it opens Browser or the YouTube VR app. If it opens in Browser, use the video title to find it in YouTube VR.</p>
        <p class="video-credit">Video by AirPano · Hosted by YouTube. Playback and availability depend on those services.</p>`;
    } else {
      content.innerHTML = `<nav class="video-breadcrumb"><a href="#">← Back to main page</a></nav>
        <div class="eyebrow">Explore places in every direction</div><h1>Recommended Videos</h1>
        <p>Five short 360° journeys. Choose a place to preview the video and open it for immersive viewing on Quest.</p>
        <div class="video-grid">${recommendedVideos.map((item) => `<a class="video-card" href="#videos/${item.id}"><div class="video-thumb"><img src="https://i.ytimg.com/vi/${item.id}/hqdefault.jpg" alt="" loading="lazy" onerror="this.hidden=true"><span>360°</span><small>${item.duration}</small></div><div class="video-card-copy"><div class="eyebrow">${item.theme}</div><h2>${item.title}</h2><p>${item.place}</p></div></a>`).join("")}</div>
        <p class="video-credit">AirPano videos are hosted by YouTube. These are scenic views with geospatial questions to guide observation.</p>`;
    }
    window.scrollTo(0, 0);
  }

  document.getElementById("videos").addEventListener("click", () => { location.hash = "videos"; });
  window.addEventListener("hashchange", render);
  render();
}
