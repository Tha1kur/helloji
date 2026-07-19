import React, { useContext, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom';

import "../App.css";
import { AuthContext } from '../contexts/AuthContext'
import withAuth from '../utils/withAuth';

function History() {

    const { getHistoryOfUser } = useContext(AuthContext);
    const navigate = useNavigate();

    const [meetings, setMeetings] = useState([]);
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const history = await getHistoryOfUser();
                setMeetings(Array.isArray(history) ? history : []);
                setStatus("ready");
            } catch (error) {
                console.error("Could not load history", error);
                setStatus("error");
            }
        }

        fetchHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const formatDate = (value) =>
        new Date(value).toLocaleDateString(undefined, {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });

    return (
        <div className='appShell'>
            <header className='container siteHeader'>
                <Link to="/home" className='brand'>
                    <span className='brand__mark' aria-hidden="true">H</span>
                    HelloJi
                </Link>

                <nav className='siteHeader__nav'>
                    <Link to="/home" className='btn btn--ghost'>Back to home</Link>
                </nav>
            </header>

            <main className='container history'>
                <h1>Your meetings</h1>
                <p className='history__lede'>Every call you have joined, most recent first.</p>

                {status === "loading" && <p className='history__lede'>Loading...</p>}

                {status === "error" && (
                    <div className='emptyState'>
                        <h2>Could not load your history</h2>
                        <p>Something went wrong reaching the server. Please try again.</p>
                        <button
                            type="button"
                            className='btn btn--primary'
                            onClick={() => window.location.reload()}
                        >
                            Retry
                        </button>
                    </div>
                )}

                {status === "ready" && meetings.length === 0 && (
                    <div className='emptyState'>
                        <h2>No meetings yet</h2>
                        <p>Once you join a call, it will show up here.</p>
                        <button
                            type="button"
                            className='btn btn--primary'
                            onClick={() => navigate("/home")}
                        >
                            Start a call
                        </button>
                    </div>
                )}

                {status === "ready" && meetings.length > 0 && (
                    <div className='history__grid'>
                        {meetings.map((meeting) => (
                            <article className='meetingCard' key={meeting._id}>
                                <p className='meetingCard__code'>{meeting.meetingCode}</p>
                                <p className='meetingCard__date'>{formatDate(meeting.date)}</p>
                            </article>
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}

export default withAuth(History)
