/* 1.0.0 */
create table user
(
    userId int auto_increment primary key,
    name   varchar(100)     not null,
    `key`  varchar(100)     not null,
    banned int(1) default 0 null,
    constraint user_key_uindex unique (`key`),
    constraint user_name_uindex unique (name)
);
insert into user (name, `key`) values ('default', '');
update `user` set userId=0 where name='default';

create table file
(
    fileId       int auto_increment primary key,
    name         varchar(20)  not null,
    fileName     varchar(20)  not null,
    mimeType     varchar(50)  not null,
    creationDate timestamp    not null,
    deletionDate timestamp    null,
    size         bigint       not null,
    processor    varchar(20)  not null,
    userId       int          not null,
    accessKey    varchar(100) not null,
    constraint file_user_userId_fk foreign key (userId) references user (userId)
);

/* 1.1.0 */
alter table file add link varchar(2048) null;
alter table file modify fileName varchar(20) null;