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

  function installHomeHub(api) {
    const history = api.Platform.History;
    const release = document.createElement("div");
    release.className = "voidify-release";
    release.hidden = true;
    let albumUri = "";
    let releaseText = "";
    let requestId = 0;
    async function updateRelease() {
      const uri = api.Player.data?.item?.metadata?.album_uri || "";
      if (uri === albumUri) return;
      albumUri = uri;
      const id = ++requestId;
      releaseText = "";
      renderRelease();
      if (!uri || !api.GraphQL?.Definitions?.getAlbum) return;
      try {
        const response = await api.GraphQL.Request(api.GraphQL.Definitions.getAlbum, {
          uri, locale: "en-US", offset: 0, limit: 1
        });
        if (id !== requestId || response.errors) return;
        const album = response.data?.albumUnion;
        if (!album) return;
        const type = String(album.type || album.albumType || "").toLowerCase();
        const label = {album: "Album", single: "Single", ep: "EP", compilation: "Compilation"}[type] || "";
        const date = album.date;
        let formatted = "";
        if (date?.isoString) {
          const value = new Date(date.isoString);
          if (!Number.isNaN(value.getTime())) {
            const options = {year: "numeric", timeZone: "UTC"};
            if (date.precision !== "YEAR") options.month = "long";
            if (!["YEAR", "MONTH"].includes(date.precision)) options.day = "numeric";
            formatted = new Intl.DateTimeFormat("en-US", options).format(value);
          }
        }
        releaseText = [label, formatted].filter(Boolean).join(" · ");
        renderRelease();
      } catch { /* Local tracks and unavailable releases can have no album metadata. */ }
    }
    function renderRelease() {
      if (release.textContent !== releaseText) release.textContent = releaseText;
      release.hidden = !releaseText;
    }
    function updateLayout() {
      const root = document.querySelector(".Root__top-container");
      if (!root) return;
      const onHome = history.location.pathname === "/";
      root.classList.toggle("voidify-home-hub", onHome);
      const widget = root.querySelector(".main-nowPlayingView-nowPlayingWidget");
      const grid = widget?.parentElement;
      if (!grid) return;
      grid.classList.add("voidify-hub-grid");
      const track = grid.querySelector(".main-nowPlayingView-contextItemInfo .main-trackInfo-name");
      if (track && release.parentElement !== track) track.append(release);
      updateRelease();
      const tiles = grid.querySelectorAll(".main-nowPlayingView-section, .main-nowPlayingView-contextItemInfo");
      for (const tile of tiles) {
        if (tile.closest(".main-nowPlayingView-nowPlayingWidget")) continue;
        let wrapper = tile.parentElement;
        while (wrapper && wrapper !== grid && !wrapper.classList.contains("main-nowPlayingView-section")) {
          wrapper.classList.add("voidify-hub-flow");
          wrapper = wrapper.parentElement;
        }
      }
    }
    // The panel stays in its React tree so its live controls retain their handlers.
    api.Player.addEventListener("songchange", updateLayout);
    history.listen(updateLayout);
    new MutationObserver(updateLayout).observe(document.body, {childList: true, subtree: true});
    updateLayout();
  }

  const installNavigation = () => {
    const api = window.Spicetify;
    if (!api?.Menu?.Item || !api.Topbar?.Button || !api.PopupModal?.display || !api.Platform?.History || !api.Player?.addEventListener) {
      setTimeout(installNavigation, 300);
      return;
    }
    installHomeHub(api);
    const about = () => {
      const content = document.createElement("div");
      content.className = "voidify-about";
      content.innerHTML = mark + "<p>Your desktop player with Voidify Marketplace, themes, and extensions.</p>";
      const version = document.createElement("small");
      version.textContent = "Voidify Desktop" + (api.Config?.version ? " ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· Engine " + api.Config.version : "");
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
