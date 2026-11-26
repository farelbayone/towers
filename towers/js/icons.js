/* Ikon SVG buatan sendiri (garis, 24x24). */
(function () {
  const P = {
    arrow: '<path d="M5 19 18 6M11 5h8v8M5 14v5h5"/>',
    cannon: '<circle cx="10" cy="14" r="6"/><path d="m14 10 4-4M18 3v2M21 6h-2M20.5 3.5 19 5"/>',
    frost: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9 4.5l3 2.5 3-2.5M9 19.5l3-2.5 3 2.5"/>',
    tesla: '<path d="M13 2 5 13h6l-1 9 9-12h-6z"/>',
    meteor: '<circle cx="9" cy="15" r="5"/><path d="m13 11 8-8M9 8l5-5M16 15l5-5"/>',
    freeze: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9"/>',
    heart: '<path d="M12 20S3 15 3 8.8C3 6 5 4 7.6 4c1.9 0 3.4 1 4.4 2.6C13 5 14.500 4 16.400 4 19 4 21 6 21 8.800 21 15 12 20 12 20z"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.500h4.500a1.800 1.800 0 0 1 0 3.600H9"/>',
    wave: '<path d="M2 9c3-4 5-4 8 0s5 4 8 0l4-2M2 17c3-4 5-4 8 0s5 4 8 0l4-2"/>',
    star: '<path d="m12 3 2.7 5.8 6.3.8-4.6 4.3 1.2 6.3-5.6-3.1-5.6 3.1 1.2-6.3L3 9.600l6.3-.8z"/>',
    route: '<circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M7 19h8a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h8"/>',
    pause: '<path d="M8 5v14M16 5v14"/>', play: '<path d="M7 4v16l13-8z"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9zM17 9a4 4 0 0 1 0 6M19.500 6.500a8 8 0 0 1 0 11"/>',
    mute: '<path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.500 9a2.500 2.500 0 1 1 3.500 2.300c-.7.4-1 .9-1 1.700M12 17h.01"/>',
    home: '<path d="m3 11 9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
    flag: '<path d="M5 22V3M5 4h12l-2 4 2 4H5"/>', map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>',
    loop: '<path d="M7 8a4 4 0 1 0 0 8c4 0 6-8 10-8a4 4 0 1 1 0 8c-4 0-6-8-10-8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.500 1.500M17.500 17.500 19 19M19 5l-1.500 1.500M6.500 17.500 5 19"/>',
    trophy: '<path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H4a4 4 0 0 0 4 5M16 6h4a4 4 0 0 1-4 5M12 14v4M8 21h8M10 18h4v3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 5-6 8-6s7 1 8 6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>', back: '<path d="M15 5l-7 7 7 7"/>'
  };
  window.KIcon = (name, cls) => `<svg class="ico ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${P[name]}</svg>`;
})();
