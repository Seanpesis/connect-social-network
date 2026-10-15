function Navbar({ user, onLogout }) {
    return (
        <div className="top-navbar">
            <div className="nav-content">
                <div className="nav-brand">Connect</div>
                <div className="nav-user">
                    <span>
                        {user.username} {user.isAdmin && <span style={{ color: '#1da1f2' }}>(Admin)</span>}
                    </span>
                    <button className="btn btn-small btn-danger" onClick={onLogout}>Logout</button>
                </div>
            </div>
        </div>
    );
}

function WelcomeCanvas({ username, postCount }) {
    const canvasRef = React.useRef(null);

    React.useEffect(() => {
        document.fonts.ready.then(draw);
    }, [username, postCount]);

    function draw() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, '#1da1f2');
        gradient.addColorStop(1, '#17bf63');

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.arc(30 + i * 45, 85 - (i % 2) * 15, 12 + (i % 3) * 6, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = 'bold 20px Nunito';
        ctx.fillText('Hello, ' + username + '!', canvas.width / 2, 40);
        ctx.font = '14px Nunito';
        ctx.fillText('You published ' + postCount + ' posts', canvas.width / 2, 65);
    }

    return <canvas ref={canvasRef} className="media-canvas" width="260" height="100"></canvas>;
}

function IntroVideo() {
    return (
        <video className="media-video" controls muted>
            <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4" />
            Your browser does not support video.
        </video>
    );
}

function MediaPanel({ username, postCount }) {
    return (
        <div className="card">
            <h3 className="card-title">Media (React)</h3>
            <WelcomeCanvas username={username} postCount={postCount} />
            <IntroVideo />
        </div>
    );
}

window.renderNavbar = (user, onLogout) => {
    ReactDOM.render(<Navbar user={user} onLogout={onLogout} />, document.getElementById('react-header'));
};

window.renderMedia = (username, postCount) => {
    ReactDOM.render(<MediaPanel username={username} postCount={postCount} />, document.getElementById('react-media'));
};

$(document).trigger('components-ready');
