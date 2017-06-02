export const present = () => {
  $('#nav-wrapper').slideUp();
  $('#mobile-nav').slideUp();
  $('.instancetitle').slideUp();
  $('.description').slideUp();
  $('#footer').slideUp();
  $('#presentationNav').fadeIn();
  $('.admincontainer').slideUp();
}

export const unPresent = () => {
  $('#nav-wrapper').slideDown();
  $('#mobile-nav').slideDown();
  $('.instancetitle').slideDown();
  $('.description').slideDown();
  $('#footer').slideDown();
  $('#presentationNav').fadeOut();
}

export const popupwindow = (url, title, w, h) => {
  const left = (screen.width / 2) - (w / 2);
  const top = (screen.height / 2) - (h / 2);
  return window.open(url, title, 'toolbar=no,'
                                +'location=no,'
                                +'directories=no,'
                                +'status=no,'
                                +'menubar=no,'
                                +'scrollbars=no,'
                                +'resizable=no,'
                                +'copyhistory=no,'
                                +'width=' + w + ','
                                +'height=' + h + ','
                                +'top=' + top + ','
                                +'left=' + left);
}


export const enableDragging = (id) => {
  Meteor.call('adminCheck', id, (error, result) => {
    function dragMoveListener(event) {
      const target = event.target;
      const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
      const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
      // Translates the question div to the current mouse position
      target.style.webkitTransform = target.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
      // Sets the z-index to 99999 so the question div floats above others
      target.style.cssText += 'z-index:99999!important;';
      target.style.backgroundColor = '#e3e3e3';
      target.setAttribute('data-x', x);
      target.setAttribute('data-y', y);
    }
    // If yes, enable draggable question divs
    if (result) {
      interact('.question-' + id)
      .ignoreFrom('textarea')
      .draggable({
        // Divs have inertia and continue moving when mouse is released
        inertia: true,
        restrict: {
          restriction: '#recent',
          endOnly: true,
          elementRect: { top: 0, left: 0, bottom: 0, right: 0 },
        },
        onmove: dragMoveListener,
        onend(event) {
          // When the question div is dropped, return to original position
          event.target.style.cssText = '-webkit-transform: translate(0px, 0px);z-index:0!important;';
          event.target.setAttribute('data-x', 0);
          event.target.setAttribute('data-y', 0);
        },
      });

      // Sets options for drop interaction
      interact('.question-' + id).dropzone({
        // Active when one .quesiton div is dropped on another
        accept: '.question-' + id,
        // The two divs need over 75% overlapping for the drop to be registered
        overlap: 0.2,
        ondropactivate(event) { // eslint-disable-line no-unused-vars
        },
        ondragenter(event) {
          event.target.style.backgroundColor = '#e3e3e3';
        },
        ondragleave(event) {
          event.target.style.backgroundColor = 'white';
        },
        // When dropped on top of another div, redirect to the /combine page
        ondrop(event) {
          const id1 = event.relatedTarget.id;
          const id2 = event.target.id;
          const parentNode = document.getElementById('nav');
          Blaze.renderWithData(Template.combine, {
            instanceid: id,
            first: id1,
            second: id2,
          }, parentNode);
          // window.location.href="/combine/" + id1 + "/" + id2;
        },
        ondropdeactivate(event) { // eslint-disable-line no-unused-vars
        },
      });
    }
  });
}

export const showListError = (reason) => {
  if (typeof currentError !== 'undefined') {
    Blaze.remove(currentError);
  }
  const parentNode = document.getElementById('list-wrapper');
  const nextNode = document.getElementById('quest-container');
  currentError = Blaze.renderWithData(Template.form_error, reason, parentNode, nextNode);
}

export const showReplyError = (reason, id) => {
  if (typeof replyError !== 'undefined') {
    Blaze.remove(replyError);
  }
  const parentNode = document.getElementById('down' + id);
  const nextNode = document.getElementById('text' + id);
  replyError = Blaze.renderWithData(Template.form_error, reason, parentNode, nextNode);
}

export const toggleButtonText = (selector) => {
  const oldText = $(selector).html();
  const toggleText = $(selector).attr('data-toggle-text');
  $(selector).attr('data-toggle-text', oldText);
  $(selector).html(toggleText);
}