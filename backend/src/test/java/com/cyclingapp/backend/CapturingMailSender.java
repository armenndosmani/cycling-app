package com.cyclingapp.backend;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.mail.MailSender;
import org.springframework.mail.SimpleMailMessage;

/** Replaces SMTP in tests: no email is ever sent, tests read the captured messages. */
class CapturingMailSender implements MailSender {

	private static final Pattern CODE = Pattern.compile("\\b(\\d{6})\\b");

	private final List<SimpleMailMessage> messages = new CopyOnWriteArrayList<>();

	@Override
	public void send(SimpleMailMessage... simpleMessages) {
		messages.addAll(Arrays.asList(simpleMessages));
	}

	List<SimpleMailMessage> messagesTo(String email) {
		return messages.stream().filter(message -> Arrays.asList(message.getTo()).contains(email)).toList();
	}

	SimpleMailMessage lastMessageTo(String email) {
		List<SimpleMailMessage> sent = messagesTo(email);
		assertThat(sent).as("emails sent").isNotEmpty();
		return sent.getLast();
	}

	String lastCodeTo(String email) {
		Matcher matcher = CODE.matcher(lastMessageTo(email).getText());
		assertThat(matcher.find()).as("code in email").isTrue();
		return matcher.group(1);
	}

}
