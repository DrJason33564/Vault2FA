// SPDX-License-Identifier: MIT
'use strict';

(function init(){
  const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  const data = String(hash.get('img') || '');
  const img = document.getElementById('qr');
  if(img) img.src = data;
})();
