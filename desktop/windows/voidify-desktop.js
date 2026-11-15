// NAME: Voidify Desktop
// DESCRIPTION: Voidify navigation and player identity.
(() => {
  const mark = '<svg aria-hidden="true" width="24" height="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M16 4.5a11.5 11.5 0 1 0 11.5 11.5" fill="none" stroke="#a478ff" stroke-width="2.7" stroke-linecap="round"/><circle cx="16" cy="16" r="4.85" fill="#f1f1f5"/></svg>';
  const title = document.querySelector("title");
  const updateTitle = () => {
    if (document.title !== "Voidify") document.title = "Voidify";
  };
  if (title) new MutationObserver(updateTitle).observe(title, { childList: true, subtree: true, characterData: true });
  updateTitle();

  function installHomeFeature(api) {
    const history = api.Platform.History;
    const feature = document.createElement("section");
    feature.className = "voidify-feature";
    feature.innerHTML = '<div><small></small><h1></h1><p></p><button type="button"></button></div><img alt="" hidden>';
    const [caption, heading, subtitle, action] = feature.firstElementChild.children;
    const artwork = feature.lastElementChild;
    function updateFeature() {
      const item = api.Player.data?.item;
      const meta = item?.metadata || {};
      const active = Boolean(meta.title);
      caption.textContent = active ? "Currently playing" : "Your library";
      heading.textContent = active ? meta.title : "Liked Songs";
      subtitle.textContent = active ? meta.artist_name || meta.album_title || "" : "";
      subtitle.hidden = !subtitle.textContent;
      action.textContent = active ? (api.Player.isPlaying() ? "Pause" : "Resume") : "Open Liked Songs";
      action.onclick = active ? () => api.Player.togglePlay() : () => history.push("/collection/tracks");
      const url = (meta.image_url || "").replace(/^spotify:image:/, "https://i.scdn.co/image/");
      if (url && artwork.getAttribute("src") !== url) artwork.src = url;
      artwork.hidden = !url;
    }
    artwork.onerror = () => { artwork.hidden = true; };
    function mount() {
      const root = document.querySelector(".Root__top-container");
      if (!root) return;
      const home = root.querySelector('.Root__main-view [data-testid="home-page"], .Root__main-view .main-home-homeHeader');
      if (history.location.pathname === "/" && home) {
        if (feature.parentElement !== home.parentElement || feature.nextElementSibling !== home) {
          home.before(feature);
          updateFeature();
        }
      } else if (feature.isConnected) feature.remove();
    }
    // Route containers also remount when the player changes layout.
    let queued = false;
    function scheduleMount() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; mount(); });
    }
    new MutationObserver(scheduleMount).observe(document.body, {childList: true, subtree: true});
    history.listen(scheduleMount);
    for (const event of ["songchange", "onplaypause"]) api.Player.addEventListener(event, updateFeature);
    mount();
  }

  const installNavigation = () => {
    const api = window.Spicetify;
    if (!api?.Menu?.Item || !api.Topbar?.Button || !api.PopupModal?.display || !api.Platform?.History || !api.Player?.addEventListener) {
      setTimeout(installNavigation, 300);
      return;
    }
    installHomeFeature(api);
    const about = () => {
      const content = document.createElement("div");
      content.className = "voidify-about";
      content.innerHTML = mark + "<p>Your desktop player with Voidify Marketplace, themes, and extensions.</p>";
      const version = document.createElement("small");
      version.textContent = "Voidify Desktop" + (api.Config?.version ? " Â· Engine " + api.Config.version : "");
      content.append(version);
      api.PopupModal.display({ title: "About Voidify", content });
    };
    const styles = document.createElement("style");
    styles.textContent = [
      ".voidify-nav-brand button {display:inline-flex!important;align-items:center;gap:5px;width:auto!important;padding:0 9px!important;color:var(--spice-text);font:700 16px/1 system-ui;letter-spacing:-.05em}",
      ".voidify-nav-brand button:hover {background:rgba(174,144,255,.15)}",
      ".voidify-about {padding:4px 2px 12px}.voidify-about svg {width:44px;height:48px}.voidify-about p {margin:12px 0}.voidify-about small {color:var(--spice-subtext)}",
      "@media(max-width:850px){.voidify-nav-brand span{display:none}}"
    ].join("\n");
    document.head.append(styles);
    const brand = new api.Topbar.Button("About Voidify", mark + "<span>voidify</span>", about);
    brand.element.classList.add("voidify-nav-brand");
    new api.Menu.Item("About Voidify", false, about).register();
  };
  installNavigation();
})();
