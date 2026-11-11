package com.cyclingapp.backend.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.MailSender;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.stereotype.Component;
import org.springframework.web.ErrorResponseException;

/**
 * Sends one-time codes as plain-text English emails over SMTP (Mailpit in development,
 * Mailjet in production). The emails contain the code and nothing about the rider.
 */
@Component
public class CodeMailer {

	private static final Logger log = LoggerFactory.getLogger(CodeMailer.class);

	private final MailSender mailSender;

	private final String from;

	CodeMailer(MailSender mailSender, @Value("${app.mail.from}") String from) {
		this.mailSender = mailSender;
		this.from = from;
	}

	public void sendSignInCode(String to, String code) {
		send(to, "Your sign-in code", """
				Your sign-in code is %s

				It is valid for %d minutes and can be used once.

				If you did not ask for this code, you can ignore this email.
				""".formatted(code, EmailCodeService.VALIDITY.toMinutes()));
	}

	public void sendDeletionCode(String to, String code) {
		send(to, "Your account deletion code", """
				Your code to confirm deleting your account is %s

				It is valid for %d minutes and can be used once. Deleting your account cannot be undone.

				If you did not ask to delete your account, do not share this code with anyone.
				""".formatted(code, EmailCodeService.VALIDITY.toMinutes()));
	}

	private void send(String to, String subject, String text) {
		SimpleMailMessage message = new SimpleMailMessage();
		message.setFrom(from);
		message.setTo(to);
		message.setSubject(subject);
		message.setText(text);
		try {
			mailSender.send(message);
		}
		catch (MailException ex) {
			// Only the exception type: its message can contain the recipient's address
			log.error("Could not send an email ({})", ex.getClass().getSimpleName());
			throw new ErrorResponseException(HttpStatus.SERVICE_UNAVAILABLE,
					AuthProblems.of(HttpStatus.SERVICE_UNAVAILABLE, null, "Service Unavailable",
							"The email could not be sent. Please try again later."),
					null);
		}
	}

}
