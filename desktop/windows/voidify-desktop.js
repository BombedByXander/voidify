// NAME: Voidify Desktop
// DESCRIPTION: Voidify navigation and player identity.
(() => {
  const mark = '<svg aria-hidden="true" width="24" height="26" viewBox="0 0 32 36"><path fill="#ae90ff" d="M3 7h7l8 15-4 7z"/><path fill="#7047ed" d="M20 7h9L16 31l-4-7z"/></svg>';
  const title = document.querySelector("title");
  const updateTitle = () => {
    if (document.title !== "Voidify") document.title = "Voidify";
  };
  if (title) new MutationObserver(updateTitle).observe(title, { childList: true, subtree: true, characterData: true });
  updateTitle();

  const installNavigation = () => {
    const api = window.Spicetify;
    if (!api?.Menu?.Item || !api.Topbar?.Button || !api.PopupModal?.display) {
      setTimeout(installNavigation, 300);
      return;
    }
    const about = () => {
      const content = document.createElement("div");
      content.className = "voidify-about";
      content.innerHTML = mark + "<p>Your desktop player with Voidify Marketplace, themes, and extensions.</p>";
      const version = document.createElement("small");
      version.textContent = "Voidify Desktop" + (api.Config?.version ? " · Engine " + api.Config.version : "");
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
