function Navbar(props) {
    return (
        <div className="top-navbar">
            <div className="nav-content">
                <div className="nav-brand">Connect</div>
                <div className="nav-user">
                    <span>
                        {props.user.username} {props.user.isAdmin && <span style={{ color: '#1da1f2' }}>(Admin)</span>}
                    </span>
                    <button className="btn btn-small btn-danger" onClick={props.onLogout}>Logout</button>
                </div>
            </div>
        </div>
    );
}

function WelcomeCanvas(props) {
    const canvasRef = React.useRef(null);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#1da1f2';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.arc(30 + i * 45, 85, 15, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = 'bold 20px Nunito';
        ctx.fillText('Hello, ' + props.username + '!', canvas.width / 2, 40);
        ctx.font = '14px Nunito';
        ctx.fillText('You published ' + props.postCount + ' posts', canvas.width / 2, 65);
    }, [props.username, props.postCount]);

    return <canvas ref={canvasRef} className="media-canvas" width="260" height="100"></canvas>;
}

function IntroVideo() {
    return (
        <video className="media-video" controls muted>
            <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4" />
        </video>
    );
}

function MediaPanel(props) {
    return (
        <div className="card">
            <h3 className="card-title">Media (React)</h3>
            <WelcomeCanvas username={props.username} postCount={props.postCount} />
            <IntroVideo />
        </div>
    );
}

window.renderNavbar = function (user, onLogout) {
    ReactDOM.render(<Navbar user={user} onLogout={onLogout} />, document.getElementById('react-header'));
};

window.renderMedia = function (username, postCount) {
    ReactDOM.render(<MediaPanel username={username} postCount={postCount} />, document.getElementById('react-media'));
};

checkSession();
