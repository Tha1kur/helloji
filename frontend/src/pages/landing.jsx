import React from 'react'
import "../App.css"
import { Link, useNavigate } from 'react-router-dom'
import { generateMeetingCode } from '../utils/meetingCode'

export default function LandingPage() {


    const router = useNavigate();

    // Guests get a fresh room each time. Previously this navigated to a
    // hardcoded room id, so every guest in the world joined the same call.
    const joinAsGuest = () => {
        router(`/${generateMeetingCode()}`)
    }

    return (
        <div className='landingPageContainer'>
            <nav>
                <div className='navHeader'>
                    <h2>HelloJi</h2>
                </div>
                <div className='navlist'>
                    <p onClick={joinAsGuest}>Join as Guest</p>
                    <p onClick={() => {
                        router("/auth")

                    }}>Register</p>
                    <div onClick={() => {
                        router("/auth")

                    }} role='button'>
                        <p>Login</p>
                    </div>
                </div>
            </nav>


            <div className="landingMainContainer">
                <div>
                    <h1>Say <span style={{ color: "#FF9839" }}>HelloJi</span> to anyone, anywhere</h1>

                    <p>Video calls right in your browser. No app to install, no account needed to join.</p>
                    <div role='button'>
                        <Link to={"/auth"}>Get Started</Link>
                    </div>
                </div>
                <div>

                    <img src="/mobile.png" alt="" />

                </div>
            </div>



        </div>
    )
}
