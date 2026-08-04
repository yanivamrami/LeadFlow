import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthPage } from './auth-page';

/**
 * Regression cover for a defect that took out every signed-out screen without a single
 * error anywhere: the form was wired with `(ngSubmit)`, which is an NgForm output, while
 * AuthPage never imported FormsModule. So the binding listened for an event nothing raised,
 * the submit button fell through to a native browser submission, and sign-in reloaded
 * itself back to an empty form.
 *
 * Nothing caught it. The build was green, the types were fine, the unit suite passed, and
 * the screen looked perfect — it simply did not work, and only a human clicking the button
 * would ever have known. Hence these two assertions, which are the two halves of "the
 * button works": the event reaches the host, and the browser is stopped from navigating.
 */
@Component({
  imports: [AuthPage],
  template: `
    <lf-auth-page title="כניסה" (submitted)="count = count + 1">
      <button type="submit" id="commit">כניסה</button>
    </lf-auth-page>
  `,
})
class Host {
  count = 0;
}

describe('AuthPage', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('emits `submitted` when the projected submit button is pressed', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('#commit');
    button.click();

    // Was 0 before the fix: the click submitted the form to the server instead.
    expect(host.count).toBe(1);
  });

  it('prevents the browser from submitting the form itself', () => {
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    const event = new Event('submit', { cancelable: true, bubbles: true });

    form.dispatchEvent(event);

    // The assertion that actually pins the bug: an uncancelled submit event is a page load.
    expect(event.defaultPrevented).toBeTrue();
    expect(host.count).toBe(1);
  });

  it('does not emit until something submits', () => {
    expect(host.count).toBe(0);
  });
});
