// NAME: Voidify Desktop
// DESCRIPTION: Identify the private Voidify player window.
(() => {
  const updateTitle = () => {
    if (document.title !== "Voidify") document.title = "Voidify";
  };
  const title = document.querySelector("title");
  if (title) new MutationObserver(updateTitle).observe(title, { childList: true, subtree: true, characterData: true });
  updateTitle();
  const addMenu = () => {
    if (!window.Spicetify?.Menu?.Item) return setTimeout(addMenu, 300);
    new Spicetify.Menu.Item("About Voidify", false, () => {
      Spicetify.PopupModal.display({ title: "Voidify", content: "Voidify Desktop · Spotify with Voidify Marketplace and themes." });
    }).register();
  };
  addMenu();
})();
