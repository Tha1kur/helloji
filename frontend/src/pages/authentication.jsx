import React from 'react';
import { Link } from 'react-router-dom';

import "../App.css";
import { AuthContext } from '../contexts/AuthContext';

export default function Authentication() {

    // Initialised to "" rather than undefined: an undefined value makes these
    // inputs start uncontrolled and switch to controlled on first keystroke,
    // which React warns about.
    const [username, setUsername] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [name, setName] = React.useState("");
    const [error, setError] = React.useState("");
    const [notice, setNotice] = React.useState("");
    const [busy, setBusy] = React.useState(false);

    // 0 = sign in, 1 = sign up
    const [formState, setFormState] = React.useState(0);
    const isRegister = formState === 1;

    const { handleRegister, handleLogin } = React.useContext(AuthContext);

    const switchMode = (next) => {
        setFormState(next);
        setError("");
        setNotice("");
    };

    const handleAuth = async (event) => {
        event.preventDefault();
        setError("");
        setNotice("");
        setBusy(true);

        try {
            if (isRegister) {
                const result = await handleRegister(name, username, password);
                setNotice(result || "Account created. You can sign in now.");
                setPassword("");
                setFormState(0);
            } else {
                await handleLogin(username, password);
            }
        } catch (err) {
            // A network failure has no response body, so reading
            // err.response.data directly would throw a second error and leave
            // the user with a silent, frozen form.
            setError(
                err.response?.data?.message ||
                "Could not reach the server. Please check your connection and try again."
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className='authPage'>
            <div className='authPanel'>
                <Link to="/" className='brand'>
                    <span className='brand__mark' aria-hidden="true">H</span>
                    HelloJi
                </Link>

                <h1 className='authPanel__title'>
                    {isRegister ? "Create your account" : "Welcome back"}
                </h1>
                <p className='authPanel__lede'>
                    {isRegister
                        ? "An account keeps a history of the calls you join."
                        : "Sign in to pick up where you left off."}
                </p>

                <div className='segmented' role="tablist">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={!isRegister}
                        className={`segmented__option ${!isRegister ? "is-active" : ""}`}
                        onClick={() => switchMode(0)}
                    >
                        Sign in
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={isRegister}
                        className={`segmented__option ${isRegister ? "is-active" : ""}`}
                        onClick={() => switchMode(1)}
                    >
                        Sign up
                    </button>
                </div>

                <form className='authForm' onSubmit={handleAuth}>
                    {isRegister && (
                        <div className='authForm__group'>
                            <label htmlFor="name">Full name</label>
                            <input
                                id="name"
                                className='field'
                                value={name}
                                autoComplete="name"
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                    )}

                    <div className='authForm__group'>
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            className='field'
                            value={username}
                            autoComplete="username"
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>

                    <div className='authForm__group'>
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            className='field'
                            value={password}
                            autoComplete={isRegister ? "new-password" : "current-password"}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        {isRegister && (
                            <p className='authForm__hint'>At least 8 characters.</p>
                        )}
                    </div>

                    {error && <p className='authForm__error' role="alert">{error}</p>}
                    {notice && <p className='authForm__notice' role="status">{notice}</p>}

                    <button
                        type="submit"
                        className='btn btn--primary authForm__submit'
                        disabled={busy}
                    >
                        {busy ? "Please wait..." : isRegister ? "Create account" : "Sign in"}
                    </button>
                </form>

                <p className='authPanel__foot'>
                    Just joining a call?{" "}
                    <Link to="/">You do not need an account.</Link>
                </p>
            </div>

            <aside className='authAside' aria-hidden="true">
                <blockquote className='authAside__quote'>
                    Share a link, and you are talking.
                </blockquote>
                <div className='authAside__tiles'>
                    <span className='authAside__tile'>A</span>
                    <span className='authAside__tile'>M</span>
                    <span className='authAside__tile'>R</span>
                </div>
            </aside>
        </div>
    );
}
