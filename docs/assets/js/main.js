// DAMA KL & Selangor — site interactions (no dependencies)
(function () {
  // Header: shrink on scroll
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 20); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // Mobile menu
  var toggle = document.querySelector(".nav-toggle");
  var links = document.getElementById("nav-links");
  if (toggle && links) {
    var setOpen = function (open) {
      links.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    toggle.addEventListener("click", function () { setOpen(!links.classList.contains("is-open")); });
    links.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
    document.addEventListener("click", function (e) {
      if (links.classList.contains("is-open") && !e.target.closest(".nav-bar")) setOpen(false);
    });
  }

  // Carousels
  document.querySelectorAll("[data-carousel]").forEach(function (wrap) {
    var track = wrap.querySelector(".carousel");
    wrap.querySelectorAll("[data-dir]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var card = track.firstElementChild;
        var step = card ? card.getBoundingClientRect().width + 26 : 300;
        track.scrollBy({ left: step * Number(btn.dataset.dir), behavior: "smooth" });
      });
    });
  });

  // Lightbox for event galleries
  var galleries = document.querySelectorAll(".gallery");
  if (galleries.length) {
    var box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Photo viewer");
    box.innerHTML = '<button class="lightbox__close" aria-label="Close photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button><img alt="">';
    document.body.appendChild(box);
    var boxImg = box.querySelector("img");
    var closeBtn = box.querySelector(".lightbox__close");
    var lastFocus = null;
    var close = function () { box.classList.remove("is-open"); if (lastFocus) lastFocus.focus(); };
    galleries.forEach(function (g) {
      g.addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn) return;
        var img = btn.querySelector("img");
        boxImg.src = img.src;
        boxImg.alt = img.alt;
        lastFocus = btn;
        box.classList.add("is-open");
        closeBtn.focus();
      });
    });
    box.addEventListener("click", function (e) { if (e.target !== boxImg) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && box.classList.contains("is-open")) close(); });
  }

  // Reveal on scroll
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-visible"); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  // Footer year
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
