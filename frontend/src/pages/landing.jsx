import React from 'react'
import { Link, useNavigate } from 'react-router-dom'

import "../App.css"
import { generateMeetingCode } from '../utils/meetingCode'

export default function LandingPage() {

    const navigate = useNavigate();

    // Guests get a fresh room each time. Previously this navigated to a
    // hardcoded room id, so every guest in the world joined the same call.
    const joinAsGuest = () => {
        navigate(`/${generateMeetingCode()}`)
    }

    return (
        <div className='landing'>
            <header className='container siteHeader'>
                <Link to="/" className='brand'>
                    <span className='brand__mark' aria-hidden="true">H</span>
                    HelloJi
                </Link>

                <nav className='siteHeader__nav'>
                    <button type="button" className='btn btn--quiet' onClick={joinAsGuest}>
                        Join as guest
                    </button>
                    <Link to="/auth" className='btn btn--ghost'>Sign in</Link>
                </nav>
            </header>

            <main className='container hero'>
                <div className='hero__copy'>
                    <p className='hero__eyebrow'>
                        <span className='hero__dot' aria-hidden="true"></span>
                        No downloads. No sign-up to join.
                    </p>

                    <h1>Say <em>HelloJi</em> to anyone, anywhere</h1>

                    <p className='hero__lede'>
                        Share a link, and you are talking. Video, screen sharing and
                        chat, running straight in the browser.
                    </p>

                    <div className='hero__actions'>
                        <button type="button" className='btn btn--primary' onClick={joinAsGuest}>
                            Start a call
                        </button>
                        <Link to="/auth" className='btn btn--ghost'>Create an account</Link>
                    </div>

                    <p className='hero__note'>
                        Calls connect peer to peer, so your video never passes through our servers.
                    </p>
                </div>

                <div className='hero__visual'>
                    <div className='mockup' role="img" aria-label="Illustration of a four person video call">
                        <div className='mockup__tile'><span>A</span></div>
                        <div className='mockup__tile'><span>M</span></div>
                        <div className='mockup__tile'><span>R</span></div>
                        <div className='mockup__tile'><span>K</span></div>

                        <div className='mockup__bar' aria-hidden="true">
                            <span className='mockup__key mockup__key--live'></span>
                            <span className='mockup__key'></span>
                            <span className='mockup__key'></span>
                            <span className='mockup__key mockup__key--end'></span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
