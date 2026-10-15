let currentUser = null;
let socket = null;
let feedMode = 'feed';

function esc(text) {
    return $('<div>').text(text === undefined || text === null ? '' : String(text)).html();
}

function errorText(xhr) {
    if (xhr.responseJSON && xhr.responseJSON.error) return xhr.responseJSON.error;
    if (xhr.status === 0) return 'Cannot reach the server';
    return 'Something went wrong';
}

function showMessage(selector, text, type) {
    $(selector)
        .stop(true, true)
        .removeClass('error success')
        .addClass(type || 'error')
        .text(text)
        .fadeIn(200)
        .delay(3500)
        .fadeOut(400);
}

function api(method, url, data) {
    const options = { url, method, dataType: 'json' };
    if (data !== undefined) {
        options.contentType = 'application/json';
        options.data = JSON.stringify(data);
    }
    return $.ajax(options);
}

function formatDate(value) {
    return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

$(document).ajaxError((event, xhr) => {
    if (xhr.status === 401 && currentUser) {
        alert('Your session has expired. Please log in again.');
        location.reload();
    }
});

$(document).on('components-ready', () => {
    api('GET', '/api/users/me')
        .done(user => startApp(user))
        .fail(() => $('#auth-container').fadeIn());
});

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
    if (!username || !password) {
        return showMessage('#auth-message', 'Please enter username and password');
    }
    api('POST', '/api/users/login', { username, password })
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
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(data.username)) {
        return showMessage('#auth-message', 'Username must be 3-20 letters, numbers or _');
    }
    if (data.password.length < 3) {
        return showMessage('#auth-message', 'Password must be at least 3 characters');
    }
    if (data.age !== '' && (data.age < 13 || data.age > 120)) {
        return showMessage('#auth-message', 'Age must be between 13 and 120');
    }
    api('POST', '/api/users/register', data)
        .done(() => location.reload())
        .fail(xhr => showMessage('#auth-message', errorText(xhr)));
});

function logout() {
    api('POST', '/api/users/logout').always(() => location.reload());
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
    if (data.password && data.password.length < 3) {
        return showMessage('#profile-message', 'Password must be at least 3 characters');
    }
    api('PUT', `/api/users/${currentUser._id}`, data)
        .done(user => {
            currentUser = user;
            fillProfile();
            showMessage('#profile-message', 'Profile saved', 'success');
        })
        .fail(xhr => showMessage('#profile-message', errorText(xhr)));
});

$('#deleteAccountBtn').click(() => {
    if (!confirm('Delete your account and all your posts? This cannot be undone.')) return;
    api('DELETE', `/api/users/${currentUser._id}`)
        .done(() => location.reload())
        .fail(xhr => showMessage('#profile-message', errorText(xhr)));
});

$('.tab').click(function () {
    const tab = $(this).data('tab');
    $('.tab').removeClass('active');
    $(this).addClass('active');
    $('.tab-content').hide();
    $(`#tab-${tab}`).fadeIn(200);

    if (tab === 'myposts') loadMyPosts();
    if (tab === 'groups') loadGroups();
    if (tab === 'users') loadUsers();
    if (tab === 'stats') loadStats();
});

function switchTab(tab) {
    $(`.tab[data-tab="${tab}"]`).click();
}

function buildPost(post) {
    const card = $('<div class="post-card">');
    const header = $('<div class="post-header">');
    header.append($('<div>')
        .append($('<span class="post-author">').text(post.author))
        .append(' ')
        .append($('<span class="badge">').text(post.groupName)));
    header.append($('<div class="post-date">').text(formatDate(post.createdAt)));
    card.append(header);
    card.append($('<div class="post-content">').text(post.content));

    const actions = $('<div class="btn-group">');
    actions.append($('<button class="btn btn-small btn-outline like-post">')
        .attr('data-id', post._id)
        .text(`Like (${post.likes})`));

    if (currentUser.isAdmin || currentUser.username === post.author) {
        actions.append($('<button class="btn btn-small btn-outline edit-post">')
            .attr('data-id', post._id)
            .data('content', post.content)
            .text('Edit'));
        actions.append($('<button class="btn btn-small btn-danger delete-post">')
            .attr('data-id', post._id)
            .text('Delete'));
    }
    card.append(actions);
    return card;
}

function renderPosts(container, posts) {
    $(container).empty();
    if (posts.length === 0) {
        $(container).append('<p class="empty">No posts found.</p>');
        return;
    }
    posts.forEach(post => $(container).append(buildPost(post)));
}

function loadPosts() {
    const url = feedMode === 'feed' ? '/api/posts/feed' : '/api/posts';
    $('#feedTitle').text(feedMode === 'feed' ? 'My Feed' : 'All Posts');
    $('#showFeedBtn').toggleClass('btn-outline', feedMode !== 'feed');
    $('#showAllBtn').toggleClass('btn-outline', feedMode !== 'all');
    api('GET', url)
        .done(posts => renderPosts('#feed', posts))
        .fail(xhr => $('#feed').html(`<p class="empty">${esc(errorText(xhr))}</p>`));
}

function loadMyPosts() {
    api('GET', '/api/posts/mine')
        .done(posts => {
            renderPosts('#my-posts', posts);
            window.renderMedia(currentUser.username, posts.length);
        });
}

function refreshAfterPostChange() {
    loadPosts();
    loadMyPosts();
    if ($('#tab-stats').is(':visible')) loadStats();
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
    if (!data.content) {
        return showMessage('#post-message', 'Post cannot be empty');
    }
    if (data.content.length > 500) {
        return showMessage('#post-message', 'Post is too long (max 500)');
    }
    api('POST', '/api/posts', data)
        .done(() => {
            $('#postContent').val('');
            showMessage('#post-message', 'Post published', 'success');
            refreshAfterPostChange();
        })
        .fail(xhr => showMessage('#post-message', errorText(xhr)));
});

$(document).on('click', '.like-post', function () {
    api('POST', `/api/posts/${$(this).attr('data-id')}/like`)
        .done(() => {
            loadPosts();
            loadMyPosts();
        })
        .fail(xhr => alert(errorText(xhr)));
});

$(document).on('click', '.edit-post', function () {
    const id = $(this).attr('data-id');
    const oldContent = $(this).data('content');
    const newContent = prompt('Edit your post:', oldContent);
    if (newContent === null) return;
    if (!newContent.trim()) return alert('Post cannot be empty');
    if (newContent.length > 500) return alert('Post is too long (max 500)');
    if (newContent.trim() === oldContent) return;

    api('PUT', `/api/posts/${id}`, { content: newContent.trim() })
        .done(() => refreshAfterPostChange())
        .fail(xhr => alert(errorText(xhr)));
});

$(document).on('click', '.delete-post', function () {
    if (!confirm('Delete this post?')) return;
    api('DELETE', `/api/posts/${$(this).attr('data-id')}`)
        .done(() => refreshAfterPostChange())
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
    api('GET', '/api/posts/search?' + $.param(params))
        .done(posts => {
            $('#feedTitle').text(`Search Results (${posts.length})`);
            renderPosts('#feed', posts);
        })
        .fail(xhr => showMessage('#post-search-message', errorText(xhr)));
});

$('#clearPostsSearchBtn').click(() => {
    $('#searchAuthor, #searchGroup, #searchContent, #searchFrom, #searchTo').val('');
    loadPosts();
});

function loadCategories() {
    api('GET', '/api/groups/categories').done(list => {
        $('#groupCategory').empty().append(new Option('Choose category', ''));
        $('#searchGroupCategory').empty().append(new Option('Any category', ''));
        list.forEach(c => {
            $('#groupCategory').append(new Option(c, c));
            $('#searchGroupCategory').append(new Option(c, c));
        });
    });
}

function canManageGroup(group) {
    return currentUser.isAdmin || group.adminUser === currentUser.username;
}

function buildGroup(group) {
    const isMember = group.members.includes(currentUser.username);
    const card = $('<div class="group-card">');
    card.append($('<h4>').text(group.name));
    card.append($('<span class="badge">').text(group.category));
    card.append($('<p>').text(group.description || 'No description'));
    card.append($('<p class="muted">').text(`Admin: ${group.adminUser} | ${group.members.length} member${group.members.length === 1 ? '' : 's'}`));

    const actions = $('<div class="btn-group">');
    if (isMember) {
        if (group.adminUser !== currentUser.username) {
            actions.append($('<button class="btn btn-small btn-grey leave-group">').attr('data-id', group._id).text('Leave'));
        }
    } else {
        actions.append($('<button class="btn btn-small join-group">').attr('data-id', group._id).text('Join'));
    }
    actions.append($('<button class="btn btn-small btn-outline view-group-posts">').data('name', group.name).text('Posts'));
    if (canManageGroup(group)) {
        actions.append($('<button class="btn btn-small btn-outline edit-group">').data('group', group).text('Edit'));
        actions.append($('<button class="btn btn-small btn-danger delete-group">').attr('data-id', group._id).text('Delete'));
    }
    card.append(actions);
    return card;
}

function renderGroups(groups) {
    $('#groups-list').empty();
    if (groups.length === 0) {
        $('#groups-list').append('<p class="empty">No groups found.</p>');
        return;
    }
    groups.forEach(g => $('#groups-list').append(buildGroup(g)));
}

function fillGroupSelect(groups) {
    const selected = $('#groupSelect').val();
    $('#groupSelect').empty();
    groups
        .filter(g => g.members.includes(currentUser.username))
        .forEach(g => $('#groupSelect').append(new Option(g.name, g.name)));
    if (selected) $('#groupSelect').val(selected);
}

function loadGroups() {
    api('GET', '/api/groups')
        .done(groups => {
            fillGroupSelect(groups);
            renderGroups(groups);
        })
        .fail(xhr => $('#groups-list').html(`<p class="empty">${esc(errorText(xhr))}</p>`));
}

function resetGroupForm() {
    $('#groupEditId, #groupName, #groupDescription').val('');
    $('#groupCategory').val('');
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
    if (!data.category) {
        return showMessage('#group-message', 'Please choose a category');
    }

    const request = id ? api('PUT', `/api/groups/${id}`, data) : api('POST', '/api/groups', data);
    request
        .done(() => {
            showMessage('#group-message', id ? 'Group updated' : 'Group created', 'success');
            resetGroupForm();
            loadGroups();
            loadPosts();
            loadMyPosts();
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
    $('#groupFormTitle').text(`Edit Group: ${group.name}`);
    $('#saveGroupBtn').text('Save');
    $('#cancelGroupEditBtn').removeClass('hidden');
    $('html, body').animate({ scrollTop: 0 }, 300);
});

$(document).on('click', '.delete-group', function () {
    if (!confirm('Delete this group and all of its posts?')) return;
    api('DELETE', `/api/groups/${$(this).attr('data-id')}`)
        .done(() => {
            resetGroupForm();
            loadGroups();
            refreshAfterPostChange();
        })
        .fail(xhr => showMessage('#group-message', errorText(xhr)));
});

$(document).on('click', '.join-group', function () {
    api('POST', `/api/groups/${$(this).attr('data-id')}/join`)
        .done(() => {
            loadGroups();
            loadPosts();
        })
        .fail(xhr => showMessage('#group-message', errorText(xhr)));
});

$(document).on('click', '.leave-group', function () {
    api('POST', `/api/groups/${$(this).attr('data-id')}/leave`)
        .done(() => {
            loadGroups();
            loadPosts();
        })
        .fail(xhr => showMessage('#group-message', errorText(xhr)));
});

$(document).on('click', '.view-group-posts', function () {
    $('#searchAuthor, #searchContent, #searchFrom, #searchTo').val('');
    $('#searchGroup').val($(this).data('name'));
    switchTab('feed');
    $('#searchPostsBtn').click();
});

$('#searchGroupsBtn').click(() => {
    const params = {
        name: $('#searchGroupName').val().trim(),
        category: $('#searchGroupCategory').val(),
        adminUser: $('#searchGroupAdmin').val().trim(),
        minMembers: $('#searchGroupMinMembers').val()
    };
    if (params.minMembers !== '' && params.minMembers < 0) {
        return showMessage('#group-search-message', 'Minimum members cannot be negative');
    }
    api('GET', '/api/groups/search?' + $.param(params))
        .done(renderGroups)
        .fail(xhr => showMessage('#group-search-message', errorText(xhr)));
});

$('#clearGroupsSearchBtn').click(() => {
    $('#searchGroupName, #searchGroupAdmin, #searchGroupMinMembers').val('');
    $('#searchGroupCategory').val('');
    loadGroups();
});

function buildUser(user) {
    const row = $('<div class="user-row">');
    const info = $('<div>');
    info.append($('<strong>').text(user.username));
    if (user.isAdmin) info.append(' ', $('<span class="badge">').text('Admin'));
    const details = [user.fullName, user.city, user.age ? `age ${user.age}` : ''].filter(Boolean).join(' | ');
    info.append($('<div class="muted">').text(details || 'No details'));
    row.append(info);

    if (currentUser.isAdmin && user._id !== currentUser._id) {
        row.append($('<button class="btn btn-small btn-danger delete-user">').attr('data-id', user._id).text('Delete'));
    }
    return row;
}

function renderUsers(users) {
    $('#users-list').empty();
    if (users.length === 0) {
        $('#users-list').append('<p class="empty">No users found.</p>');
        return;
    }
    users.forEach(u => $('#users-list').append(buildUser(u)));
}

function loadUsers() {
    api('GET', '/api/users')
        .done(renderUsers)
        .fail(xhr => showMessage('#users-message', errorText(xhr)));
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
    api('GET', '/api/users/search?' + $.param(params))
        .done(renderUsers)
        .fail(xhr => showMessage('#user-search-message', errorText(xhr)));
});

$('#clearUsersSearchBtn').click(() => {
    $('#searchUsername, #searchCity, #searchMinAge, #searchMaxAge').val('');
    loadUsers();
});

$(document).on('click', '.delete-user', function () {
    if (!confirm('Delete this user, their posts and memberships?')) return;
    api('DELETE', `/api/users/${$(this).attr('data-id')}`)
        .done(() => {
            showMessage('#users-message', 'User deleted', 'success');
            loadUsers();
            loadGroups();
            loadPosts();
        })
        .fail(xhr => showMessage('#users-message', errorText(xhr)));
});

function drawEmptyChart(svg, width, height) {
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#657786')
        .text('No data yet');
}

function drawGroupsChart(data) {
    const svg = d3.select('#chart-groups');
    svg.selectAll('*').remove();
    const width = +svg.attr('width');
    const height = +svg.attr('height');
    const margin = { top: 20, right: 10, bottom: 50, left: 35 };

    if (data.length === 0) return drawEmptyChart(svg, width, height);

    const x = d3.scaleBand()
        .domain(data.map(d => d._id))
        .range([margin.left, width - margin.right])
        .padding(0.25);
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count)])
        .nice()
        .range([height - margin.bottom, margin.top]);

    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).tickFormat(name => name.length > 8 ? name.substring(0, 8) + '..' : name))
        .selectAll('text')
        .attr('transform', 'rotate(-30)')
        .style('text-anchor', 'end');

    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('d')));

    svg.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d._id))
        .attr('width', x.bandwidth())
        .attr('y', height - margin.bottom)
        .attr('height', 0)
        .attr('rx', 4)
        .attr('fill', '#1da1f2')
        .transition()
        .duration(700)
        .attr('y', d => y(d.count))
        .attr('height', d => y(0) - y(d.count));

    svg.selectAll('.bar-label')
        .data(data)
        .enter()
        .append('text')
        .attr('x', d => x(d._id) + x.bandwidth() / 2)
        .attr('y', d => y(d.count) - 4)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .text(d => d.count);
}

function drawMonthsChart(data) {
    const svg = d3.select('#chart-months');
    svg.selectAll('*').remove();
    const width = +svg.attr('width');
    const height = +svg.attr('height');
    const margin = { top: 20, right: 15, bottom: 40, left: 35 };

    if (data.length === 0) return drawEmptyChart(svg, width, height);

    const x = d3.scalePoint()
        .domain(data.map(d => d._id))
        .range([margin.left + 10, width - margin.right - 10]);
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count)])
        .nice()
        .range([height - margin.bottom, margin.top]);

    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x));

    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('d')));

    const line = d3.line()
        .x(d => x(d._id))
        .y(d => y(d.count));

    svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#17bf63')
        .attr('stroke-width', 3)
        .attr('d', line);

    svg.selectAll('.dot')
        .data(data)
        .enter()
        .append('circle')
        .attr('cx', d => x(d._id))
        .attr('cy', d => y(d.count))
        .attr('r', 5)
        .attr('fill', '#17bf63')
        .append('title')
        .text(d => `${d._id}: ${d.count} posts`);
}

function loadStats() {
    api('GET', '/api/posts/stats')
        .done(stats => {
            drawGroupsChart(stats.perGroup);
            drawMonthsChart(stats.perMonth);
        })
        .fail(xhr => alert(errorText(xhr)));
}

function addChatMessage(message) {
    const item = $('<li class="chat-msg">');
    if (message.user === currentUser.username) item.addClass('mine');
    item.append($('<strong>').text(message.user));
    item.append($('<span>').text(message.text));
    $('#chat-messages').append(item);
    const list = $('#chat-messages')[0];
    list.scrollTop = list.scrollHeight;
}

function connectChat() {
    socket = io();
    socket.on('chatHistory', messages => {
        $('#chat-messages').empty();
        messages.forEach(addChatMessage);
    });
    socket.on('chatMessage', addChatMessage);
}

$('#sendChatBtn').click(() => {
    const text = $('#chatInput').val().trim();
    if (!text || !socket) return;
    socket.emit('chatMessage', text);
    $('#chatInput').val('');
});

$('#chatInput').keypress(e => {
    if (e.which === 13) $('#sendChatBtn').click();
});

$('#chatHeader').click(() => {
    $('#chat-body').slideToggle(200);
});
