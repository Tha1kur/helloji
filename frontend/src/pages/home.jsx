import React, { useContext, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import "../App.css";
import withAuth from '../utils/withAuth'
import { AuthContext } from '../contexts/AuthContext';
import { generateMeetingCode } from '../utils/meetingCode';

function HomeComponent() {

    const navigate = useNavigate();
    const [meetingCode, setMeetingCode] = useState("");

    const { addToUserHistory, handleLogout, user } = useContext(AuthContext);

    const joinMeeting = async (code) => {
        if (!code) return;

        // Recording the meeting in history should never stop someone joining
        // the call, so a failure here is logged rather than surfaced.
        try {
            await addToUserHistory(code)
        } catch (error) {
            console.error("Could not save meeting to history", error)
        }

        navigate(`/${code}`)
    }

    const handleJoinVideoCall = () => joinMeeting(meetingCode.trim());
    const handleNewMeeting = () => joinMeeting(generateMeetingCode());

    return (
        <div className='appShell'>
            <header className='container siteHeader'>
                <Link to="/home" className='brand'>
                    <span className='brand__mark' aria-hidden="true">H</span>
                    HelloJi
                </Link>

                <nav className='siteHeader__nav'>
                    <Link to="/history" className='btn btn--quiet'>History</Link>
                    <button type="button" className='btn btn--ghost' onClick={handleLogout}>
                        Sign out
                    </button>
                </nav>
            </header>

            <main className='container home'>
                <div>
                    <h1>{user?.name ? `Hello, ${user.name.split(" ")[0]}` : "Start a call"}</h1>
                    <p className='home__lede'>
                        Create a new meeting, or enter a code someone shared with you.
                    </p>

                    <div className='joinCard'>
                        <label className='joinCard__label' htmlFor="meeting-code">
                            Meeting code
                        </label>

                        <div className='joinCard__row'>
                            <input
                                id="meeting-code"
                                className='field'
                                placeholder="e.g. kqp-4mn-x7t"
                                value={meetingCode}
                                onChange={(e) => setMeetingCode(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleJoinVideoCall(); }}
                            />
                            <button
                                type="button"
                                className='btn btn--primary'
                                onClick={handleJoinVideoCall}
                                disabled={!meetingCode.trim()}
                            >
                                Join
                            </button>
                        </div>

                        <p className='joinCard__hint'>
                            Nothing to join?{" "}
                            <button type="button" className='btn btn--quiet' onClick={handleNewMeeting}>
                                Create a new meeting
                            </button>
                        </p>
                    </div>
                </div>

                <aside className='home__aside'>
                    <div className='featureCard'>
                        <h3>Peer to peer</h3>
                        <p>Video and audio travel directly between browsers, never through our servers.</p>
                    </div>
                    <div className='featureCard'>
                        <h3>Share your screen</h3>
                        <p>Present a tab, a window or your whole desktop without installing anything.</p>
                    </div>
                    <div className='featureCard'>
                        <h3>Chat alongside</h3>
                        <p>Send links and notes during the call, with unread counts while the panel is closed.</p>
                    </div>
                </aside>
            </main>
        </div>
    )
}

export default withAuth(HomeComponent)
