import React from 'react';
import './slugline.scss';
import { BrowserRouter, Switch, Route } from 'react-router-dom';

import Header from './header/Header';
import IssuesList from './issues/issues_list';

const App: React.FC = () => {
    return (
        <BrowserRouter>
            <div className="container">
                <Header />
                <div>
                    <Switch>
                        <Route exact path="/">
                            HOME CONTENT
                        </Route>
                        <Route path="/issues">
                            <IssuesList/>
                        </Route>
                    </Switch>
                    <p>CONTENT</p>
                </div>
            </div>
        </BrowserRouter>
    );
}

export default App;
