const menuToggle = document.querySelector(".menu-toggle");
const primaryNavigation = document.querySelector(".primary-navigation");

if (menuToggle && primaryNavigation) {
  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    primaryNavigation.classList.toggle("is-open", !isOpen);
    document.body.classList.toggle("menu-open", !isOpen);
  });
}

const searchForm = document.querySelector(".site-search");
const searchInput = document.querySelector("#search-input");
const searchResults = document.querySelector("#search-results");
const searchStatus = document.querySelector("#search-status");

if (searchForm && searchInput && searchResults && searchStatus) {
  let index = [];

  fetch("/search-index.json")
    .then((response) => response.json())
    .then((data) => {
      index = data;
      const query = new URLSearchParams(window.location.search).get("q");
      if (query) {
        searchInput.value = query;
        runSearch(query);
      }
    })
    .catch(() => {
      searchStatus.textContent = "Search is temporarily unavailable.";
    });

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    const url = new URL(window.location);
    if (query) {
      url.searchParams.set("q", query);
    } else {
      url.searchParams.delete("q");
    }
    window.history.replaceState({}, "", url);
    runSearch(query);
  });

  function runSearch(query) {
    if (!query) {
      searchStatus.textContent = "Enter a term to search the SCP website.";
      searchResults.replaceChildren();
      return;
    }

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = index
      .map((item) => {
        const title = item.title.toLowerCase();
        const haystack =
          `${item.title} ${item.description} ${item.content}`.toLowerCase();
        const score = terms.reduce(
          (total, term) =>
            total +
            (title.includes(term) ? 5 : 0) +
            (haystack.includes(term) ? 1 : 0),
          0
        );
        return { ...item, score };
      })
      .filter((item) => item.score >= terms.length)
      .sort((a, b) => b.score - a.score)
      .slice(0, 24);

    searchStatus.textContent = `${matches.length} result${matches.length === 1 ? "" : "s"} for "${query}"`;
    searchResults.innerHTML = matches
      .map(
        (item) => `
          <article>
            <p class="eyebrow">${escapeText(item.type)}</p>
            <h2><a href="${item.url}">${escapeText(item.title)}</a></h2>
            <p>${escapeText(item.description)}</p>
          </article>`
      )
      .join("");
  }
}

function escapeText(value) {
  const span = document.createElement("span");
  span.textContent = value;
  return span.innerHTML;
}
