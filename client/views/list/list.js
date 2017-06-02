import { Answers, Questions, Instances, Votes } from '/lib/common.js';
import { present, unPresent, popupwindow, enableDragging, showListError, showReplyError, toggleButtonText } from '/client/views/list/helpers.js';

Template.list.onCreated(function () {
  this.seconds = new ReactiveVar(0);
  Session.set('search', 'all');
  const adminMod = Meteor.user() && (Template.instance().data.admin === Meteor.user().emails[0].address || Template.instance().data.moderators.indexOf(Meteor.user().emails[0].address) > -1);
  // eslint-disable-next-line max-len
  if (adminMod) {
    enableDragging(Template.instance().data._id);
  }

  this.autorun((computation) => {
    console.log('Autorunning..');
    $('#quest-container').isotope('updateSortData').isotope();
  });
});

Template.list.onRendered(() => {
  document.title = 'Live Question Answer Tool';
  $('#topinputcontainer').hide();
  $('head').append('<link rel="alternate" type="application/rss+xml" href="/rss/{{tablename}}"/>');

  $('#quest-container').isotope({
    itemSelector: '.question-wrapper',
    layoutMode: 'masonry',
    getSortData: {
      hidden: (item) => $(item).data('hidden') ? 1 : 0,
      rank: (item) => {
        /*
          Goal: determine questions that are "hot right now", and sort accordingly.
          Activity:
            1. Question posted
            2. Reply
            3. Upvote
          Total Score: 0
          Lifetime: (how new the question is, compared to oldest question)
            = (((Now - date of first question) / (Now - date of this question)) - 1)
            So the oldest question would be 0, and the larger the number is, the newer the question.
            This allows us to use it as a factor for "newness", so the newer the question is, the more
            likely it is to become "hot".
          Process:
            - Go through each individual activity:
              * Get its date.
              * Divide that date by "now" (so if it just happened, that would be = 1,
                                           happened -2 seconds ago, less than 1,
                                           and so on as we approach 0)
              * Multiply by the activity's weight
              * Add to total score
            - Add lifetime to total score
        */
        let total_score = 0;
        let activity = { posted: [], reply: [], upvote: [] };
        const id = $(item).data('id');
        const weights = { posted: 1, reply: 0.5, upvote: 0.1 };
        const post_date = $(item).data('posted');
        const now = new Date().getTime() - 1000;
        const first_question = Questions.findOne({ instanceid: Template.instance().data._id }).timeorder;
        const lifetime = ((now - first_question) / (now - post_date)) - 1;
        activity.posted.push(post_date * weights.posted);
        Answers.find({ qid: id }).forEach((reply) => {
          const time_diff = reply.timeorder / now;
          total_score += time_diff * weights.reply;
        });
        Votes.find({ qid: id }).forEach((vote) => {
          const time_diff = vote.timeorder ? vote.timeorder / now : 1;
          total_score += time_diff * weights.upvote;
        });
        total_score += lifetime;
        return total_score;
      },
    },
    sortBy: ['hidden', 'rank'],
    sortAscending: {
      hidden: true,
      rank: false,
    }
  });

});

Template.list.helpers({
  admin() {
    return Meteor.user() && Meteor.user().emails[0].address === Template.instance().data.admin;
  },
  moderator() {
    return Meteor.user() && Template.instance().data.moderators.indexOf(Meteor.user().emails[0].address) !== -1;
  },
  visible() {
    if (this.state !== 'disabled') return true;

    let tableAdmin = false;
    let tableMod = false;
    let instance = Instances.findOne({ _id: this.instanceid });

    if (Meteor.user()) {
      const userEmail = Meteor.user().emails[0].address;
      if (instance.admin === userEmail) {
        tableAdmin = true;
      } else if (instance.moderators.indexOf(userEmail) !== -1) {
        tableMod = true;
      }
    }

    return tableAdmin || tableMod;
  },
  hasSeconds() {
    return Template.instance().seconds.get() > 0 && !Template.instance().state.get('typing');
  },
  seconds() {
    return Template.instance().seconds.get();
  },
  question() {
    let showHidden = false;
    if (Meteor.user()) {
      const userEmail = Meteor.user().emails[0].address;
      if (this.admin === userEmail || this.moderators.indexOf(userEmail) !== -1) {
        showHidden = true;
      }
    }
    const query = showHidden ?
                  { instanceid: this._id } :
                  { instanceid: this._id, state: { $ne: 'disabled' } };
    return Questions.find(query);
  },
});

/* eslint-disable func-names, no-unused-vars */
Template.list.events({
  // When the vote button is clicked...
  'click .voteright': function (event, template) {
    Meteor.call('vote', event.currentTarget.id, (error, result) => {
      // If the result is an object, there was an error
      if (typeof result === 'object') {
        // Store an object of the error names and codes
        const errorCodes = {
          votedbefore: 'It appears that you have already voted up this question.',
          lasttouch: 'There was an error retrieving the time. Please return to the list and try again.',
          votes: 'There was an error incrementing the votes. Please return to the list and try again.',
          qid: 'There was an error with the question ID. Please return to the list and try again.',
          ip: 'There was an error with your IP address. Please return to the list and try again.',
          tablename: 'There was an error with the table name. Please return to the list and try again.',
        };
        // Alerts the error if one exists
        showListError(errorCodes[result[0].name]);
      }
    });
  },
  // When the admin hide button is clicked...
  'click .adminquestionhide': function (event, template) {
    // Call the server-side hide method to hide the question
    if (Questions.findOne({ _id: event.currentTarget.id }).state === 'disabled') {
      Meteor.call('unhideThis', event.currentTarget.id);
    } else {
      Meteor.call('hideThis', event.currentTarget.id);
    }
  },
  // When the admin unhide button is clicked...
  'click #unhidebutton': function (event, template) {
    // Call the server-side unhide method to unhide all questions
    Meteor.call('unhide', template.data._id);
  },
  'click #deletebutton': function (event, template) {
    popoverTemplate = Blaze.renderWithData(Template.delete, Instances.findOne({ _id: $(event.target.parentElement).data('tableId') }), document.getElementById('nav'));
  },
  'click #navAsk': function (event, template) {
    const parentNode = document.getElementById('nav-wrapper');
    dropDownTemplate = Blaze.renderWithData(Template.propose, template.data, parentNode);
    const questionDiv = document.getElementById('toparea');
    if (questionDiv.style.display === 'none' || !questionDiv.style.display) {
      toggleButtonText('#navAsk');
      document.getElementById('navAsk').style.backgroundColor = '#ec4f4f';
      $('#toparea').slideDown();
      $('#questioninput').focus();
      Template.instance().state.set('typing', true);
    } else {
      if (typeof currentError !== 'undefined') {
        Blaze.remove(currentError);
      }
      toggleButtonText('#navAsk');
      document.getElementById('navAsk').style.backgroundColor = '#27ae60';
      $('#toparea').slideUp();
      if (typeof dropDownTemplate !== 'undefined') {
        Blaze.remove(dropDownTemplate);
      }
      Template.instance().state.set('typing', false);
    }
  },
  'click .checkbox': function (event, template) {
    const checked = event.target.firstElementChild;
    if (checked.style.display === 'none' || !checked.style.display) {
      checked.style.display = 'block';
    }
  },
  'click .checked': function (event, template) {
    const checked = event.target;
    if (checked.style.display === 'block') {
      checked.style.display = 'none';
    }
  },
  'click .replybottombutton': function (event, template) {
    // Retrieves data from form
    const theID = event.target.id;
    const anon = false;
    const answer = document.getElementById('text' + theID).value;

    // Calls a server-side method to answer a question and update DBs
    Meteor.call('answer', template.data._id, answer, theID, anon, (e, r) => {
      // If the result is an object, there was an error
      if (typeof r === 'object') {
        // Store an object of the error names and codes
        const errorCodes = {
          text: 'Please enter an answer.',
          poster: 'Please enter a valid name.',
          email: 'Please enter a valid email address.',
          ip: 'There was an error with your IP address. Try again.',
          instanceid: 'There was an error with the instance id. Try again.',
          qid: 'There was an error with the question ID.',
          anonymous: 'The admin has disabled anonymous posting.',
        };
        // Alert the error
        showReplyError(errorCodes[r[0].name], theID);
        return false;
      }
      if (typeof replyError !== 'undefined') {
        Blaze.remove(replyError);
      }
      document.getElementById('reply' + theID).innerHTML = 'Reply';
      document.getElementById('text' + theID).value = '';
      $('#down' + theID).slideUp();
    });
  },

  'click .anon-reply-bottom-button': function (event, template) {
    // Retrieves data from form
    const theID = event.target.id;
    // var anonymous = document.getElementById("anonbox").checked;
    const answer = document.getElementById('text' + theID).value;

    const anon = true;
    // Calls a server-side method to answer a question and update DBs
    Meteor.call('answer', template.data._id, answer, theID, anon, (e, r) => {
      // If the result is an object, there was an error
      if (typeof r === 'object') {
        // Store an object of the error names and codes
        const errorCodes = {
          text: 'Please enter an answer.',
          poster: 'Please enter a valid name.',
          email: 'Please enter a valid email address.',
          ip: 'There was an error with your IP address. Try again.',
          instanceid: 'There was an error with the instance id. Try again.',
          qid: 'There was an error with the question ID.',
          anonymous: 'The admin has disabled anonymous posting.',
        };
        // Alert the error
        showReplyError(errorCodes[r[0].name], theID);
        return false;
      }
      if (typeof replyError !== 'undefined') {
        Blaze.remove(replyError);
      }
      document.getElementById('reply' + theID).innerHTML = 'Reply';
      document.getElementById('text' + theID).value = '';
      $('#down' + theID).slideUp();
    });
  },
  'keypress .replyemail': function (event, template) {
    // eslint-disable-next-line no-param-reassign
    event.which = event.which || event.keyCode;
    if (event.which === 13) {
      event.preventDefault();
      const theID = event.target.id.substring(5);
      const buttons = document.getElementsByClassName('replybottombutton');
      for (let b = 0; b < buttons.length; b++) {
        if (buttons[b].id === theID) {
          buttons[b].click();
        }
      }
    }
  },
  'keyup #searchbar': function (event, template) {
    if (event.target.value) {
      Session.set('search', event.target.value);
    } else {
      Session.set('search', 'all');
    }
    // return Users.find({name: {$regex: re}});
  },
  'click .facebookbutton': function (event, template) {
    popupwindow('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(window.location.origin + '/list/' + template.data.slug), 'Share Question Tool!', 600, 400);
  },
  'click .twitterbutton': function (event, template) {
    const questionDiv = event.target.parentElement.parentElement.parentElement;
    let questionText = questionDiv.getElementsByClassName('questiontext')[0].innerHTML.trim();
    if (questionText.length > 35) {
      questionText = questionText.substring(0, 34);
    }
    const tweetText = 'Check out this question: "' + questionText + '..." on Question Tool by @berkmancenter ' + window.location.origin + '/list/' + template.data.slug;
    popupwindow('https://twitter.com/intent/tweet?text=' + encodeURIComponent(tweetText), 'Share Question Tool!', 600, 400);
  },
  'click #modbutton': function (event, template) {
    const parentNode = document.getElementById('nav');
    popoverTemplate = Blaze.renderWithData(Template.add, template.data, parentNode);
  },
  'click #renamebutton': function (event, template) {
    const parentNode = document.getElementById('nav');
    const table = Template.instance().data;
    popoverTemplate = Blaze.renderWithData(Template.rename, {
      table,
      isList: true,
    }, parentNode);
  },
  'click #navPresent': function (event, template) {
    present();
    Template.instance().state.set('presentMode', true);
    $(document).on('keydown', (e) => {
      if (e.keyCode === 27) {
        unPresent();
        $(document).off('keydown');
        Template.instance().state.set('presentMode', false);
      }
    });
  },
  'click #navUnPresent': function (event, template) {
    unPresent();
    Template.instance().state.set('presentMode', true);
  },
  'click .new-posts': function (event, template) {
    Template.instance().onShowChanges();
  },
  'focus .replyarea': function(event, template) {
    Template.instance().state.set('typing', true);
  },
  'blur .replyarea': function(event, template) {
    Template.instance().state.set('typing', false);
  },
});
/* eslint-enable func-names, no-unused-vars */
