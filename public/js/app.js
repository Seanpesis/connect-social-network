let currentUser = null;
let socket = null;
let feedMode = 'feed';

function showMessage(selector, text, type) {
    $(selector).removeClass('error success').addClass(type || 'error').text(text).show();
    setTimeout(() => $(selector).fadeOut(), 3000);
}

function errorText(xhr) {
    if (xhr.responseJSON && xhr.responseJSON.error) {
        return xhr.responseJSON.error;
    }
    return 'Something went wrong';
}

function sendJson(method, url, data) {
    return $.ajax({
        url: url,
        method: method,
        contentType: 'application/json',
        data: JSON.stringify(data || {})
    });
}

function checkSession() {
    $.get('/api/users/me')
        .done(user => startApp(user))
        .fail(() => $('#auth-container').fadeIn());
}

$('#showRegister').click(() => {
    $('#login-form').hide();
    $('#register-form').fadeIn();
});

$('#showLogin').click(() => {
    $('#register-form').hide();
    $('#login-form').fadeIn();
});

$('#loginBtn').click(() => {
    const username = $('#loginUsername').val().trim();
    const password = $('#loginPassword').val().trim();

    if (username === '' || password === '') {
        return showMessage('#auth-message', 'Please enter username and password');
    }

    sendJson('POST', '/api/users/login', { username: username, password: password })
        .done(() => location.reload())
        .fail(xhr => showMessage('#auth-message', errorText(xhr)));
});

$('#loginPassword').keypress(e => {
    if (e.which === 13) $('#loginBtn').click();
});

$('#registerBtn').click(() => {
    const data = {
        username: $('#regUsername').val().trim(),
        password: $('#regPassword').val().trim(),
        fullName: $('#regFullName').val().trim(),
        city: $('#regCity').val().trim(),
        age: $('#regAge').val()
    };

    if (data.username.length < 3 || data.username.length > 20 || data.username.includes(' ')) {
        return showMessage('#auth-message', 'Username must be 3-20 characters without spaces');
    }
    if (data.password.length < 3) {
        return showMessage('#auth-message', 'Password must be at least 3 characters');
    }
    if (data.age !== '' && (data.age < 13 || data.age > 120)) {
        return showMessage('#auth-message', 'Age must be between 13 and 120');
    }

    sendJson('POST', '/api/users/register', data)
        .done(() => location.reload())
        .fail(xhr => showMessage('#auth-message', errorText(xhr)));
});

function logout() {
    $.post('/api/users/logout', () => location.reload());
}

function startApp(user) {
    currentUser = user;
    $('#auth-container').hide();
    $('#app-container').fadeIn();
    $('#chat-window').fadeIn();

    window.renderNavbar(currentUser, logout);
    fillProfile();
    loadCategories();
    loadGroups();
    loadPosts();
    loadMyPosts();
    connectChat();
}

function fillProfile() {
    $('#profileFullName').val(currentUser.fullName || '');
    $('#profileCity').val(currentUser.city || '');
    $('#profileAge').val(currentUser.age || '');
    $('#profilePassword').val('');
}

$('#saveProfileBtn').click(() => {
    const data = {
        fullName: $('#profileFullName').val().trim(),
        city: $('#profileCity').val().trim(),
        age: $('#profileAge').val(),
        password: $('#profilePassword').val().trim()
    };

    if (data.age !== '' && (data.age < 13 || data.age > 120)) {
        return showMessage('#profile-message', 'Age must be between 13 and 120');
    }
    if (data.password !== '' && data.password.length < 3) {
        return showMessage('#profile-message', 'Password must be at least 3 characters');
    }

    sendJson('PUT', '/api/users/' + currentUser._id, data)
        .done(user => {
            currentUser = user;
            fillProfile();
            showMessage('#profile-message', 'Profile saved', 'success');
        })
        .fail(xhr => showMessage('#profile-message', errorText(xhr)));
});

$('#deleteAccountBtn').click(() => {
    if (!confirm('Delete your account and all your posts?')) return;

    $.ajax({ url: '/api/users/' + currentUser._id, method: 'DELETE' })
        .done(() => location.reload())
        .fail(xhr => showMessage('#profile-message', errorText(xhr)));
});

$('.tab').click(function () {
    const tab = $(this).data('tab');
    $('.tab').removeClass('active');
    $(this).addClass('active');
    $('.tab-content').hide();
    $('#tab-' + tab).fadeIn(200);

    if (tab === 'myposts') loadMyPosts();
    if (tab === 'groups') loadGroups();
    if (tab === 'users') loadUsers();
    if (tab === 'stats') loadStats();
});

function buildPost(post) {
    const card = $('<div class="post-card"></div>');

    const header = $('<div class="post-header"></div>');
    const who = $('<div></div>');
    who.append($('<span class="post-author"></span>').text(post.author));
    who.append(' ');
    who.append($('<span class="badge"></span>').text(post.groupName));
    header.append(who);
    header.append($('<div class="post-date"></div>').text(new Date(post.createdAt).toLocaleString()));

    card.append(header);
    card.append($('<div class="post-content"></div>').text(post.content));

    const actions = $('<div class="btn-group"></div>');
    actions.append($('<button class="btn btn-small btn-outline like-post"></button>')
        .attr('data-id', post._id)
        .text('Like (' + post.likes + ')'));

    if (currentUser.isAdmin || currentUser.username === post.author) {
        actions.append($('<button class="btn btn-small btn-outline edit-post">Edit</button>')
            .attr('data-id', post._id)
            .data('content', post.content));
        actions.append($('<button class="btn btn-small btn-danger delete-post">Delete</button>')
            .attr('data-id', post._id));
    }

    card.append(actions);
    return card;
}

function showPosts(container, posts) {
    $(container).empty();
    if (posts.length === 0) {
        $(container).append('<p class="empty">No posts found.</p>');
        return;
    }
    posts.forEach(post => $(container).append(buildPost(post)));
}

function loadPosts() {
    let url = '/api/posts/feed';
    $('#feedTitle').text('My Feed');
    if (feedMode === 'all') {
        url = '/api/posts';
        $('#feedTitle').text('All Posts');
    }

    $('#showFeedBtn').toggleClass('btn-outline', feedMode !== 'feed');
    $('#showAllBtn').toggleClass('btn-outline', feedMode !== 'all');

    $.get(url, posts => showPosts('#feed', posts));
}

function loadMyPosts() {
    $.get('/api/posts/mine', posts => {
        showPosts('#my-posts', posts);
        window.renderMedia(currentUser.username, posts.length);
    });
}

function refreshPosts() {
    loadPosts();
    loadMyPosts();
    if ($('#tab-stats').is(':visible')) {
        loadStats();
    }
}

$('#showFeedBtn').click(() => {
    feedMode = 'feed';
    loadPosts();
});

$('#showAllBtn').click(() => {
    feedMode = 'all';
    loadPosts();
});

$('#createPostBtn').click(() => {
    const data = {
        content: $('#postContent').val().trim(),
        groupName: $('#groupSelect').val()
    };

    if (!data.groupName) {
        return showMessage('#post-message', 'Join or create a group before posting');
    }
    if (data.content === '') {
        return showMessage('#post-message', 'Post cannot be empty');
    }

    sendJson('POST', '/api/posts', data)
        .done(() => {
            $('#postContent').val('');
            showMessage('#post-message', 'Post published', 'success');
            refreshPosts();
        })
        .fail(xhr => showMessage('#post-message', errorText(xhr)));
});

$(document).on('click', '.like-post', function () {
    $.post('/api/posts/' + $(this).attr('data-id') + '/like')
        .done(() => refreshPosts())
        .fail(xhr => alert(errorText(xhr)));
});

$(document).on('click', '.edit-post', function () {
    const id = $(this).attr('data-id');
    const oldContent = $(this).data('content');
    const newContent = prompt('Edit your post:', oldContent);

    if (newContent === null || newContent.trim() === oldContent) return;
    if (newContent.trim() === '') {
        return alert('Post cannot be empty');
    }

    sendJson('PUT', '/api/posts/' + id, { content: newContent.trim() })
        .done(() => refreshPosts())
        .fail(xhr => alert(errorText(xhr)));
});

$(document).on('click', '.delete-post', function () {
    if (!confirm('Delete this post?')) return;

    $.ajax({ url: '/api/posts/' + $(this).attr('data-id'), method: 'DELETE' })
        .done(() => refreshPosts())
        .fail(xhr => alert(errorText(xhr)));
});

$('#searchPostsBtn').click(() => {
    const params = {
        author: $('#searchAuthor').val().trim(),
        groupName: $('#searchGroup').val().trim(),
        content: $('#searchContent').val().trim(),
        fromDate: $('#searchFrom').val(),
        toDate: $('#searchTo').val()
    };

    if (params.fromDate && params.toDate && params.fromDate > params.toDate) {
        return showMessage('#post-search-message', 'From date must be before To date');
    }

    $.get('/api/posts/search', params)
        .done(posts => {
            $('#feedTitle').text('Search Results (' + posts.length + ')');
            showPosts('#feed', posts);
        })
        .fail(xhr => showMessage('#post-search-message', errorText(xhr)));
});

$('#clearPostsSearchBtn').click(() => {
    $('#searchAuthor, #searchGroup, #searchContent, #searchFrom, #searchTo').val('');
    loadPosts();
});

function loadCategories() {
    $.get('/api/groups/categories', categories => {
        $('#groupCategory').empty().append('<option value="">Choose category</option>');
        $('#searchGroupCategory').empty().append('<option value="">Any category</option>');
        categories.forEach(category => {
            $('#groupCategory').append(new Option(category, category));
            $('#searchGroupCategory').append(new Option(category, category));
        });
    });
}

function buildGroup(group) {
    const isMember = group.members.includes(currentUser.username);
    const isGroupAdmin = currentUser.isAdmin || group.adminUser === currentUser.username;

    const card = $('<div class="group-card"></div>');
    card.append($('<h4></h4>').text(group.name));
    card.append($('<span class="badge"></span>').text(group.category));
    card.append($('<p></p>').text(group.description || 'No description'));
    card.append($('<p class="muted"></p>').text('Admin: ' + group.adminUser + ' | Members: ' + group.members.length));

    const actions = $('<div class="btn-group"></div>');
    if (!isMember) {
        actions.append($('<button class="btn btn-small join-group">Join</button>').attr('data-id', group._id));
    } else if (group.adminUser !== currentUser.username) {
        actions.append($('<button class="btn btn-small btn-grey leave-group">Leave</button>').attr('data-id', group._id));
    }
    actions.append($('<button class="btn btn-small btn-outline view-group-posts">Posts</button>').data('name', group.name));
    if (isGroupAdmin) {
        actions.append($('<button class="btn btn-small btn-outline edit-group">Edit</button>').data('group', group));
        actions.append($('<button class="btn btn-small btn-danger delete-group">Delete</button>').attr('data-id', group._id));
    }

    card.append(actions);
    return card;
}

function showGroups(groups) {
    $('#groups-list').empty();
    if (groups.length === 0) {
        $('#groups-list').append('<p class="empty">No groups found.</p>');
        return;
    }
    groups.forEach(group => $('#groups-list').append(buildGroup(group)));
}

function loadGroups() {
    $.get('/api/groups', groups => {
        $('#groupSelect').empty();
        groups.forEach(group => {
            if (group.members.includes(currentUser.username)) {
                $('#groupSelect').append(new Option(group.name, group.name));
            }
        });
        showGroups(groups);
    });
}

function resetGroupForm() {
    $('#groupEditId, #groupName, #groupDescription, #groupCategory').val('');
    $('#groupFormTitle').text('Create Group');
    $('#saveGroupBtn').text('Create');
    $('#cancelGroupEditBtn').addClass('hidden');
}

$('#saveGroupBtn').click(() => {
    const id = $('#groupEditId').val();
    const data = {
        name: $('#groupName').val().trim(),
        category: $('#groupCategory').val(),
        description: $('#groupDescription').val().trim()
    };

    if (data.name.length < 2 || data.name.length > 40) {
        return showMessage('#group-message', 'Group name must be 2-40 characters');
    }
    if (data.category === '') {
        return showMessage('#group-message', 'Please choose a category');
    }

    let request;
    if (id) {
        request = sendJson('PUT', '/api/groups/' + id, data);
    } else {
        request = sendJson('POST', '/api/groups', data);
    }

    request
        .done(() => {
            showMessage('#group-message', id ? 'Group updated' : 'Group created', 'success');
            resetGroupForm();
            loadGroups();
            refreshPosts();
        })
        .fail(xhr => showMessage('#group-message', errorText(xhr)));
});

$('#cancelGroupEditBtn').click(resetGroupForm);

$(document).on('click', '.edit-group', function () {
    const group = $(this).data('group');
    $('#groupEditId').val(group._id);
    $('#groupName').val(group.name);
    $('#groupCategory').val(group.category);
    $('#groupDescription').val(group.description);
    $('#groupFormTitle').text('Edit Group: ' + group.name);
    $('#saveGroupBtn').text('Save');
    $('#cancelGroupEditBtn').removeClass('hidden');
    $('html, body').animate({ scrollTop: 0 }, 300);
});

$(document).on('click', '.delete-group', function () {
    if (!confirm('Delete this group and all of its posts?')) return;

    $.ajax({ url: '/api/groups/' + $(this).attr('data-id'), method: 'DELETE' })
        .done(() => {
            resetGroupForm();
            loadGroups();
            refreshPosts();
        })
        .fail(xhr => showMessage('#group-message', errorText(xhr)));
});

$(document).on('click', '.join-group', function () {
    $.post('/api/groups/' + $(this).attr('data-id') + '/join')
        .done(() => {
            loadGroups();
            loadPosts();
        })
        .fail(xhr => showMessage('#group-message', errorText(xhr)));
});

$(document).on('click', '.leave-group', function () {
    $.post('/api/groups/' + $(this).attr('data-id') + '/leave')
        .done(() => {
            loadGroups();
            loadPosts();
        })
        .fail(xhr => showMessage('#group-message', errorText(xhr)));
});

$(document).on('click', '.view-group-posts', function () {
    $('#searchAuthor, #searchContent, #searchFrom, #searchTo').val('');
    $('#searchGroup').val($(this).data('name'));
    $('.tab[data-tab="feed"]').click();
    $('#searchPostsBtn').click();
});

$('#searchGroupsBtn').click(() => {
    const params = {
        name: $('#searchGroupName').val().trim(),
        category: $('#searchGroupCategory').val(),
        adminUser: $('#searchGroupAdmin').val().trim()
    };

    $.get('/api/groups/search', params)
        .done(groups => showGroups(groups))
        .fail(xhr => showMessage('#group-search-message', errorText(xhr)));
});

$('#clearGroupsSearchBtn').click(() => {
    $('#searchGroupName, #searchGroupAdmin, #searchGroupCategory').val('');
    loadGroups();
});

function buildUser(user) {
    const row = $('<div class="user-row"></div>');
    const info = $('<div></div>');
    info.append($('<strong></strong>').text(user.username));
    if (user.isAdmin) {
        info.append(' <span class="badge">Admin</span>');
    }

    let details = (user.fullName || '') + ' | ' + (user.city || '');
    if (user.age) {
        details = details + ' | age ' + user.age;
    }
    info.append($('<div class="muted"></div>').text(details));
    row.append(info);

    if (currentUser.isAdmin && user._id !== currentUser._id) {
        row.append($('<button class="btn btn-small btn-danger delete-user">Delete</button>').attr('data-id', user._id));
    }
    return row;
}

function showUsers(users) {
    $('#users-list').empty();
    if (users.length === 0) {
        $('#users-list').append('<p class="empty">No users found.</p>');
        return;
    }
    users.forEach(user => $('#users-list').append(buildUser(user)));
}

function loadUsers() {
    $.get('/api/users', users => showUsers(users));
}

$('#searchUsersBtn').click(() => {
    const params = {
        username: $('#searchUsername').val().trim(),
        city: $('#searchCity').val().trim(),
        minAge: $('#searchMinAge').val(),
        maxAge: $('#searchMaxAge').val()
    };

    if (params.minAge !== '' && params.maxAge !== '' && Number(params.minAge) > Number(params.maxAge)) {
        return showMessage('#user-search-message', 'Minimum age cannot be bigger than maximum age');
    }

    $.get('/api/users/search', params)
        .done(users => showUsers(users))
        .fail(xhr => showMessage('#user-search-message', errorText(xhr)));
});

$('#clearUsersSearchBtn').click(() => {
    $('#searchUsername, #searchCity, #searchMinAge, #searchMaxAge').val('');
    loadUsers();
});

$(document).on('click', '.delete-user', function () {
    if (!confirm('Delete this user and all of their posts?')) return;

    $.ajax({ url: '/api/users/' + $(this).attr('data-id'), method: 'DELETE' })
        .done(() => {
            showMessage('#users-message', 'User deleted', 'success');
            loadUsers();
            loadGroups();
            loadPosts();
        })
        .fail(xhr => showMessage('#users-message', errorText(xhr)));
});

function drawBarChart(svgId, data, color) {
    const svg = d3.select(svgId);
    svg.selectAll('*').remove();

    const width = 340;
    const height = 260;
    const barWidth = Math.min(40, (width - 20) / data.length - 10);
    const gap = (width - data.length * barWidth) / (data.length + 1);

    if (data.length === 0) {
        svg.append('text').attr('x', width / 2).attr('y', height / 2)
            .attr('text-anchor', 'middle').text('No data yet');
        return;
    }

    const maxCount = d3.max(data, d => d.count);
    const y = d3.scaleLinear().domain([0, maxCount]).range([0, height - 70]);

    svg.selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', (d, i) => gap + i * (barWidth + gap))
        .attr('y', d => height - 40 - y(d.count))
        .attr('width', barWidth)
        .attr('height', d => y(d.count))
        .attr('rx', 4)
        .attr('fill', color);

    svg.selectAll('.count')
        .data(data)
        .enter()
        .append('text')
        .attr('class', 'count')
        .attr('x', (d, i) => gap + i * (barWidth + gap) + barWidth / 2)
        .attr('y', d => height - 45 - y(d.count))
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .text(d => d.count);

    svg.selectAll('.label')
        .data(data)
        .enter()
        .append('text')
        .attr('class', 'label')
        .attr('x', (d, i) => gap + i * (barWidth + gap) + barWidth / 2)
        .attr('y', height - 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .text(d => d._id.substring(0, 8));
}

function loadStats() {
    $.get('/api/posts/stats', stats => {
        drawBarChart('#chart-groups', stats.perGroup, '#1da1f2');
        drawBarChart('#chart-months', stats.perMonth, '#17bf63');
    });
}

function addChatMessage(message) {
    const item = $('<li class="chat-msg"></li>');
    if (message.user === currentUser.username) {
        item.addClass('mine');
    }
    item.append($('<strong></strong>').text(message.user));
    item.append($('<span></span>').text(message.text));
    $('#chat-messages').append(item);
    $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);
}

function connectChat() {
    socket = io();

    socket.on('chatHistory', messages => {
        $('#chat-messages').empty();
        messages.forEach(message => addChatMessage(message));
    });

    socket.on('chatMessage', message => addChatMessage(message));
}

$('#sendChatBtn').click(() => {
    const text = $('#chatInput').val().trim();
    if (text === '') return;

    socket.emit('chatMessage', { user: currentUser.username, text: text });
    $('#chatInput').val('');
});

$('#chatInput').keypress(e => {
    if (e.which === 13) $('#sendChatBtn').click();
});

$('#chatHeader').click(() => {
    $('#chat-body').slideToggle(200);
});
